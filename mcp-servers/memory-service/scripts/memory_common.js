const fs = require('fs');
const path = require('path');

// 简单的命令行参数解析：仅支持 `--key value` 与 `--flag` 两种形式
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

// 记忆根目录：优先使用 MEMORY_BASE_DIR，其次尝试项目根目录下的 memorys/，最后降级到当前目录
function memoryBaseDir() {
  const explicit = process.env.MEMORY_BASE_DIR;
  if (explicit && String(explicit).trim()) return path.resolve(String(explicit));
  
  // 尝试定位项目根目录（假设 mcp-servers/memory-service/scripts 是当前脚本位置）
  // 向上 3 级到达项目根目录： scripts -> memory-service -> mcp-servers -> project_root
  const projectRoot = path.resolve(__dirname, '../../..');
  const projectMemoryDir = path.join(projectRoot, 'memorys');
  
  // 如果 memorys 目录不存在，为了兼容性（或初次运行），我们还是指向这里，让 store 脚本去创建
  return projectMemoryDir;
}

// 路径安全：保证读取目标必须落在 memoryBaseDir() 内部，防止路径穿越（../）
function ensureInsideBaseDir(targetPath) {
  const base = memoryBaseDir();
  const resolvedBase = path.resolve(base) + path.sep;
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedBase)) {
    throw new Error(`path_outside_memory_base_dir: ${resolvedTarget}`);
  }
}

function toIsoString(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// 生成可读且唯一性足够的 ID（MVP 使用：时间戳 + 随机串）
function generateId(date = new Date()) {
  const pad2 = (n) => String(n).padStart(2, '0');
  const stamp =
    String(date.getFullYear()) +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    pad2(date.getHours()) +
    pad2(date.getMinutes()) +
    pad2(date.getSeconds());
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}_${rand}`;
}

// 文件名安全 slug：保留中文/英文/数字/下划线/短横线，其它字符剔除
function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/\\]+/g, '_')
    .replace(/[^\w\u4e00-\u9fff-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

// 只覆盖 MVP 必要的 YAML 标量解析：string/bool/number/JSON array
function parseYamlScalar(raw) {
  const v = String(raw).trim();
  if (!v) return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('[') && v.endsWith(']')) {
    try {
      const parsed = JSON.parse(v);
      return parsed;
    } catch {
      return v;
    }
  }
  return v;
}

// 解析 Markdown 文件的 YAML Frontmatter（仅支持最常见格式）
// 兼容：\n 与 \r\n，兼容结尾的 `---` 后没有额外换行
function parseFrontmatter(markdown) {
  const raw0 = String(markdown || '').replace(/^\uFEFF/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw0);
  if (!m) return { frontmatter: null, body: raw0 };

  const fmText = m[1];
  const body = raw0.slice(m[0].length);

  const frontmatter = {};
  const lines = fmText.split(/\r?\n/);
  let currentArrayKey = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const arrayItemMatch = /^\s*-\s+(.*)$/.exec(line);
    if (arrayItemMatch && currentArrayKey) {
      frontmatter[currentArrayKey].push(parseYamlScalar(arrayItemMatch[1]));
      continue;
    }
    const m = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const valueRaw = m[2];
    if (valueRaw === '') {
      currentArrayKey = key;
      frontmatter[key] = [];
      continue;
    }
    currentArrayKey = null;
    frontmatter[key] = parseYamlScalar(valueRaw);
  }

  return { frontmatter, body };
}

// 生成用于写入的 YAML Frontmatter：MVP 直接用 JSON.stringify 保证可解析与转义安全
function buildFrontmatterYaml(fields) {
  const lines = ['---'];
  const orderedKeys = [
    'id',
    'name',
    'description',
    'created_at',
    'updated_at',
    'tags',
    'files',
    'type',
    'importance',
  ];
  const extraKeys = Object.keys(fields).filter((k) => !orderedKeys.includes(k));
  const keys = [...orderedKeys, ...extraKeys];
  for (const key of keys) {
    const value = fields[key];
    if (value == null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
      continue;
    }
    if (typeof value === 'string') {
      const safe = value.replace(/\r?\n/g, ' ').trim();
      lines.push(`${key}: ${JSON.stringify(safe)}`);
      continue;
    }
    lines.push(`${key}: ${String(value)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

// 递归列出目录下全部 Markdown 文件（*.md）
function listMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const queue = [dir];
  while (queue.length) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const p = path.join(current, ent.name);
      if (ent.isDirectory()) queue.push(p);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) results.push(p);
    }
  }
  return results;
}

// 安全读取：仅允许读取 memoryBaseDir() 内部文件
function safeReadFile(targetPath) {
  ensureInsideBaseDir(targetPath);
  return fs.readFileSync(targetPath, 'utf8');
}

function normalizeStringList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  const str = String(value).trim();
  if (!str) return [];
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
    } catch {}
  }
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeTags(tags) {
  return normalizeStringList(tags);
}

function normalizeFiles(files) {
  return normalizeStringList(files);
}

// 从 frontmatter 生成对外返回的摘要（供“先挑选摘要，再按需取全文”工作流使用）
function summarizeFromFrontmatter(frontmatter, absolutePath) {
  const base = memoryBaseDir();
  ensureInsideBaseDir(absolutePath);
  const rel = path.relative(base, absolutePath).split(path.sep).join('/');
  const tags = normalizeTags(frontmatter.tags);
  const files = normalizeFiles(frontmatter.files);
  return {
    id: frontmatter.id || null,
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    tags,
    files,
    type: frontmatter.type || 'memory',
    importance: typeof frontmatter.importance === 'number' ? frontmatter.importance : 5,
    created_at: frontmatter.created_at || null,
    updated_at: frontmatter.updated_at || null,
    path: rel,
  };
}

// 预留：简单分词（当前版本 memory_search 已不使用；保留便于后续升级检索）
function tokenizeQuery(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  if (/\s/.test(q)) return q.split(/\s+/).filter(Boolean);
  return [q];
}

module.exports = {
  parseArgs,
  memoryBaseDir,
  ensureInsideBaseDir,
  toIsoString,
  generateId,
  slugify,
  parseFrontmatter,
  buildFrontmatterYaml,
  listMarkdownFiles,
  safeReadFile,
  normalizeTags,
  normalizeFiles,
  summarizeFromFrontmatter,
  tokenizeQuery,
};
