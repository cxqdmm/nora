import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { LLMService } from './llm-service.js';
import { MCPManager } from './mcp-manager.js';
import { Logger } from './logger.js';

const MEMORYER_SYSTEM_PROMPT = `
你是一个专业的记忆检索专家 (Memory Retrieval Expert)。
你的任务是根据用户的查询 (Query) 和一组记忆摘要 (Summaries)，判断哪些记忆是真正相关的，并决定需要读取哪些记忆的详细内容。

**输入：**
1. 用户查询 (Query)
2. 记忆摘要列表 (JSON 格式，包含 id, name, description, tags 等)

**输出：**
你必须输出一个 JSON 对象，包含一个 \`ids\` 数组，列出你认为最相关的记忆 ID。
如果没有任何相关记忆，返回空数组。

\`\`\`json
{
  "ids": ["id_1", "id_2"]
}
\`\`\`

**判断标准：**
- 优先选择与查询意图高度匹配的记忆。
- 如果摘要信息不足以回答问题，但看起来可能包含答案，也应该选中。
- 不要选择过多无关记忆，保持精简（通常 1-3 个最相关的即可）。
`;

import { MemoryManager } from './context-manager.js';

export class Memoryer {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  async retrieve(userQuery: string, summaries: any[], memoryMcp: MCPManager, memoryManager?: MemoryManager): Promise<string> {
    if (!summaries || summaries.length === 0) {
      return "没有找到任何相关记忆摘要。";
    }

    // 1. Ask LLM to select relevant IDs
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: MEMORYER_SYSTEM_PROMPT },
      { 
        role: "user", 
        content: `用户查询: "${userQuery}"\n\n记忆摘要列表:\n${JSON.stringify(summaries, null, 2)}` 
      }
    ];

    Logger.info("Memoryer", "Analyzing summaries to select relevant memories...");
    
    let targetIds: string[] = [];
    try {
      const response = await this.llm.chat(messages, undefined, undefined, "Memory-Retrieve");
      const content = response.content || "{}";
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.ids)) {
        targetIds = parsed.ids;
      }
    } catch (e) {
      Logger.error("Memoryer", `Failed to parse selection: ${e}`);
      return "记忆分析失败，无法提取详细内容。";
    }

    if (targetIds.length === 0) {
      Logger.info("Memoryer", "No relevant memories selected by LLM.");
      return "根据摘要判断，没有找到与查询足够相关的详细记忆。";
    }

    Logger.info("Memoryer", `Selected IDs: ${targetIds.join(", ")}`);

    // 2. Fetch full content for selected IDs
    const contents: string[] = [];
    for (const id of targetIds) {
      try {
        Logger.info("Memoryer", `Reading memory: ${id}`);
        
        // Check if it's a short-term memory (based on summary metadata if available, or just try)
        // We look up the summary object to check 'source'
        const summary = summaries.find(s => s.id === id);
        
        if (summary && summary.source === 'short_term' && memoryManager && typeof (memoryManager as any).readShortTermMemory === 'function') {
           const content = await (memoryManager as any).readShortTermMemory(id);
           if (content) {
             contents.push(`--- Short-Term Memory ID: ${id} ---\n${content}\n--- End of Memory ---`);
           } else {
             Logger.warn("Memoryer", `Short-term memory ${id} found in summary but content read failed.`);
           }
        } else {
            // Default to Long-Term Memory (MCP)
            // Call read_memory tool
            // Note: We assume the tool name is 'read_memory' and it takes 'id'
            const result = await memoryMcp.callTool('read_memory', { id });
             
             const text = (result as any).content.map((c: any) => c.type === 'text' ? c.text : '').join("\n");
             contents.push(`--- Memory ID: ${id} ---\n${text}\n--- End of Memory ---`);
        }
      } catch (e: any) {
        Logger.error("Memoryer", `Failed to read memory ${id}: ${e.message}`);
      }
    }

    if (contents.length === 0) {
      return "尝试读取选定记忆时失败。";
    }

    return `以下是根据您的查询检索到的详细记忆内容：\n\n${contents.join("\n\n")}`;
  }
}
