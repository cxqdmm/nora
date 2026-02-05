const path = require('path');

const {
  parseArgs,
  memoryBaseDir,
  listMarkdownFiles,
  safeReadFile,
  parseFrontmatter,
  summarizeFromFrontmatter,
} = require('./memory_common');

function main() {
  const args = parseArgs(process.argv.slice(2));
  // 目标：输出“所有记忆摘要列表”（默认不过滤），供大模型选择后再用 memory_get 拉取全文
  // 可选：传入 --query 时仅做简单包含匹配（不做打分/分词/TopK）
  const query = String(args.query || '').trim().toLowerCase();
  
  const base = memoryBaseDir();
  const memoriesDir = path.join(base, 'memories');
  const files = listMarkdownFiles(memoriesDir);

  const summaries = [];

  for (const file of files) {
    const raw = safeReadFile(file);
    const { frontmatter } = parseFrontmatter(raw);
    
    // 跳过不合法文件（没有 frontmatter 或缺少 id）
    if (!frontmatter || !frontmatter.id) continue;
    
    const summary = summarizeFromFrontmatter(frontmatter, file);
    
    // 暂时禁用 Query 过滤，返回全量记忆，由 Agent 自行筛选
    /*
    if (query) {
      const text = [
        summary.name || '',
        summary.description || '',
        Array.isArray(summary.tags) ? summary.tags.join(' ') : (summary.tags || ''),
        Array.isArray(summary.files) ? summary.files.join(' ') : (summary.files || ''),
        summary.type || ''
      ].join(' ').toLowerCase();
      
      const keywords = query.split(/\s+/).filter(Boolean);
      const isMatch = keywords.some(k => text.includes(k));

      if (!isMatch) {
        continue;
      }
    }
    */
    
    summaries.push(summary);
  }

  // 按时间倒序：updated_at 优先，其次 created_at（无法解析的时间按 0 处理）
  summaries.sort((a, b) => {
    const tA = Date.parse(a.updated_at || a.created_at || '');
    const tB = Date.parse(b.updated_at || b.created_at || '');
    const timeA = Number.isFinite(tA) ? tA : 0;
    const timeB = Number.isFinite(tB) ? tB : 0;
    return timeB - timeA;
  });

  // 默认返回全部摘要；为了更好控制上下文长度，可选传入 --limit 做简单截断
  const limit = args.limit ? Number(args.limit) : 0;
  
  const result = Number.isFinite(limit) && limit > 0 ? summaries.slice(0, limit) : summaries;

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();
