import { Logger } from './logger.js';
import { LLMService } from './llm-service.js';

export interface MemoryUnit {
  id: string;
  turnId: number;
  role: 'user' | 'assistant' | 'tool';
  summary: string;
  content: string;
  toolName?: string;
  toolArgs?: any;
  timestamp: number;
  relatedId?: string;
}

export class MemoryManager {
  private memoryStream: MemoryUnit[] = [];
  private llm: LLMService;
  
  constructor(llm: LLMService) {
    this.llm = llm;
  }

  addMemory(unit: MemoryUnit) {
    this.memoryStream.push(unit);

    // Broadcast update to UI (Viewer)
    // Map memory units to viewer context items
    const contextItems = this.memoryStream.map(m => ({
        source: `${m.role.toUpperCase()} (T${m.turnId})`,
        content: m.summary || m.content.substring(0, 50) + '...',
        fullContent: m.content, // Send full content for inspection
        timestamp: m.timestamp
    }));
    
    // Invert order to show newest at top for better visibility in side panel
    // or keep chronological? Side panels usually show newest first if it's a "state" view.
    // Let's try newest first (reverse).
    Logger.contextUpdate(contextItems.reverse());
    Logger.historyStats(this.memoryStream.length, 0); // 0 means no hard limit displayed
  }

  getStream(): MemoryUnit[] {
    return this.memoryStream;
  }

  private async generateSummary(role: 'user' | 'assistant' | 'tool', content: string, extraInfo: string = ""): Promise<string> {
      let systemInstruction = "";
      if (role === 'user') {
          systemInstruction = "请为用户的这句发言生成一个极其简短的摘要（1句，<20字），保留核心意图和关键实体。";
      } else if (role === 'tool') {
          systemInstruction = "请为这个工具执行结果生成一个极其简短的摘要（1句，<30字）。概括操作对象和结果，包含关键标识符。核心目标是让后续检索能判断是否包含细节。";
      } else {
          systemInstruction = "请为 AI 助手的这段回复生成一个极其简短的摘要（1句，<20字），保留核心结论或建议。";
      }

      const prompt = `
${systemInstruction}

内容片段：
"""
${extraInfo ? `[Info: ${extraInfo}]\n` : ''}${content.substring(0, 500)}
"""

摘要：`;

      try {
          const response = await this.llm.chat([{ role: 'user', content: prompt }], undefined, undefined, `Memory-Summarize-${role}`);
          return response.content?.trim() || `${role} message`;
      } catch (e) {
          Logger.warn("Memory", `Failed to summarize ${role} content`);
          return `${role} message`;
      }
  }

  async summarizeUserMessage(content: string, turnId: number): Promise<MemoryUnit> {
      const summary = await this.generateSummary('user', content);
      const unit: MemoryUnit = {
          id: Math.random().toString(36).substring(2, 10),
          turnId,
          role: 'user',
          summary,
          content,
          timestamp: Date.now()
      };
      this.addMemory(unit);
      return unit;
  }

  async summarizeToolOutput(toolName: string, args: any, output: string, turnId: number, relatedId?: string): Promise<MemoryUnit> {
      const summary = await this.generateSummary('tool', output, `Tool: ${toolName}, Args: ${JSON.stringify(args)}`);
      const unit: MemoryUnit = {
          id: Math.random().toString(36).substring(2, 10),
          turnId,
          role: 'tool',
          summary,
          content: output,
          toolName,
          toolArgs: args,
          timestamp: Date.now(),
          relatedId
      };
      this.addMemory(unit);
      return unit;
  }

  async summarizeAssistantReply(content: string, turnId: number): Promise<MemoryUnit> {
      const summary = await this.generateSummary('assistant', content);
      const unit: MemoryUnit = {
          id: Math.random().toString(36).substring(2, 10),
          turnId,
          role: 'assistant',
          summary,
          content,
          timestamp: Date.now()
      };
      this.addMemory(unit);
      return unit;
  }

  async retrieveContext(userQuery: string): Promise<string> {
    if (this.memoryStream.length === 0) return "";

    const summaryList = this.memoryStream.map((u, index) => {
        return `${index}. [${u.role.toUpperCase()}] (Turn ${u.turnId}) ${u.summary} (ID: ${u.id})`;
    }).join('\n');

    const prompt = `
你是一个记忆检索专家。基于用户的最新问题，从历史摘要中找出**必须回溯细节**才能回答的条目。
用户问题：${userQuery}

历史摘要：
${summaryList}

判断标准：
1. 如果摘要提到“代码”、“文件内容”、“错误日志”，且与问题相关，必须选中。
2. 只选最有用的 1-3 条。不要选无关的闲聊。
3. 如果没有相关的，返回空列表。

输出格式 (JSON):
{
  "relevant_ids": ["id1", "id2"]
}
`;

    let relevantIds: string[] = [];
    try {
        const response = await this.llm.chat([{ role: 'user', content: prompt }], undefined, undefined, "Memory-Retrieve-ShortTerm");
        const raw = response.content || "{}";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.relevant_ids)) {
                relevantIds = parsed.relevant_ids;
            }
        }
    } catch (e) {
        Logger.warn("Memory", "Failed to retrieve relevant context");
    }

    if (relevantIds.length === 0) return "";

    const contextParts = relevantIds.map(id => {
        const unit = this.memoryStream.find(u => u.id === id);
        if (!unit) return "";
        return `
=== Context Recall (Turn ${unit.turnId}) ===
Type: ${unit.role}
Summary: ${unit.summary}
Content:
${unit.content}
=========================================
`;
    });

    Logger.info("Memory", `Retrieved ${relevantIds.length} context units for query: "${userQuery}"`);
    return contextParts.join('\n');
  }
}
