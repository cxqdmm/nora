const fs = require('fs');
const path = require('path');

const {
  parseArgs,
  memoryBaseDir,
  ensureInsideBaseDir,
  listMarkdownFiles,
  safeReadFile,
  parseFrontmatter,
  summarizeFromFrontmatter,
} = require('./memory_common');

// 按 id 全量扫描查找（MVP 用法：简单可靠；规模很大时再引入索引）
function findById(id) {
  const base = memoryBaseDir();
  const memoriesDir = path.join(base, 'memories');
  const files = listMarkdownFiles(memoriesDir);
  for (const file of files) {
    const raw = safeReadFile(file);
    const { frontmatter } = parseFrontmatter(raw);
    if (frontmatter && String(frontmatter.id) === id) {
      return { file, raw, frontmatter };
    }
  }
  return null;
}

// 按相对路径读取（相对 memoryBaseDir），并强制做目录边界校验，避免读取任意文件
function readByRelativePath(rel) {
  const base = memoryBaseDir();
  const full = path.resolve(base, rel);
  ensureInsideBaseDir(full);
  const raw = fs.readFileSync(full, 'utf8');
  const { frontmatter } = parseFrontmatter(raw);
  return { file: full, raw, frontmatter };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const id = args.id != null ? String(args.id).trim() : '';
  const relPath = args.path != null ? String(args.path).trim() : '';

  if (!id && !relPath) {
    process.stderr.write('missing_required_arg: --id or --path\n');
    process.exit(1);
  }

  let found = null;
  if (id) found = findById(id);
  else found = readByRelativePath(relPath);

  if (!found) {
    process.stderr.write('memory_not_found\n');
    process.exit(1);
  }

  // 只把摘要和原始 Markdown 返回给调用方，便于“摘要挑选 → 取全文 → 再摘要/再推理”的链路
  const summary = found.frontmatter
    ? summarizeFromFrontmatter(found.frontmatter, found.file)
    : { id: null, path: null };

  process.stdout.write(
    JSON.stringify(
      {
        summary,
        rawMarkdown: found.raw,
      },
      null,
      2,
    ) + '\n',
  );
}

main();
