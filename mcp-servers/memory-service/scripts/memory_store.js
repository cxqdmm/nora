const fs = require('fs');
const path = require('path');

const {
  parseArgs,
  memoryBaseDir,
  toIsoString,
  generateId,
  slugify,
  buildFrontmatterYaml,
  normalizeTags,
  normalizeFiles,
} = require('./memory_common');

// 从 stdin 读取正文：方便用管道把长文本传给脚本（例如 echo/cat/模型输出）
function readBodyFromStdin() {
  if (process.stdin.isTTY) return '';
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// 对正文做最小结构化：如果用户只给一段文本，就自动包一层“场景背景/解决方案/关键决策点”
function buildBody(bodyRaw) {
  const body = String(bodyRaw || '').trim();
  if (!body) {
    return ['## 场景背景', '', '## 解决方案', '', '## 关键决策点', ''].join('\n');
  }
  if (body.includes('\n## ')) return body;
  return ['## 场景背景', body, '', '## 解决方案', '', '## 关键决策点', ''].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = String(args.name || '').trim();
  const description = String(args.description || '').trim();
  if (!name) {
    process.stderr.write('missing_required_arg: --name\n');
    process.exit(1);
  }
  const tags = normalizeTags(args.tags);
  const files = normalizeFiles(args.files);
  const type = String(args.type || 'memory').trim() || 'memory';
  const importance = args.importance != null ? Number(args.importance) : 5;
  const now = new Date();
  const id = generateId(now);
  const slug = slugify(name) || 'memory';

  // 目录按日期归档：memories/YYYY-MM-DD/
  const dateDir = toIsoString(now).slice(0, 10);
  const baseDir = memoryBaseDir();
  const targetDir = path.join(baseDir, 'memories', dateDir);
  ensureDir(targetDir);

  const filename = `${id}_${slug}.md`;
  const fullPath = path.join(targetDir, filename);
  const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/');

  const body = args.body != null ? String(args.body) : readBodyFromStdin();
  const markdown = [
    buildFrontmatterYaml({
      id,
      name,
      description,
      created_at: toIsoString(now),
      updated_at: toIsoString(now),
      tags,
      files,
      type,
      importance: Number.isFinite(importance) ? importance : 5,
    }),
    '',
    buildBody(body),
    '',
  ].join('\n');

  fs.writeFileSync(fullPath, markdown, 'utf8');

  // 输出摘要：大模型通常只需要摘要来做“候选选择”，再用 memory_get 拉取全文
  const summary = {
    id,
    name,
    description,
    tags,
    files,
    type,
    importance: Number.isFinite(importance) ? importance : 5,
    created_at: toIsoString(now),
    updated_at: toIsoString(now),
    path: relPath,
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

main();
