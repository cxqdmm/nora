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
  taskId: string; // Add taskId
}

export interface UserInputRecord {
  turnId: number;
  content: string;
  taskId: string;
  timestamp: number;
}

export class MemoryManager {
  private memoryStream: MemoryUnit[] = [];
  private llm: LLMService;
  
  constructor(llm: LLMService) {
    this.llm = llm;
  }

  /**
   * Get chronological list of user inputs for context analysis
   */
  getUserInputHistory(limit: number = 20): UserInputRecord[] {
    return this.memoryStream
      .filter(u => u.role === 'user')
      .slice(-limit)
      .map(u => ({
        turnId: u.turnId,
        content: u.content,
        taskId: u.taskId,
        timestamp: u.timestamp
      }));
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
          const response = await this.llm.chat([{ role: 'user', content: prompt }], undefined, undefined, `记忆摘要-${role}`);
          return response.content?.trim() || `${role} message`;
      } catch (e) {
          Logger.warn("Memory", `${role} 内容摘要生成失败: ${e}`);
          return `${role} message`;
      }
  }

  async summarizeUserMessage(content: string, turnId: number, taskId: string): Promise<MemoryUnit> {
      let summary: string;
      if (content.length > 100) {
          summary = await this.generateSummary('user', content);
      } else {
          summary = content;
      }
      Logger.info("Memory", `用户消息记录 (轮次 ${turnId}): "${summary}"`);
      const unit: MemoryUnit = {
          id: Math.random().toString(36).substring(2, 10),
          turnId,
          role: 'user',
          summary,
          content,
          timestamp: Date.now(),
          taskId
      };
      this.addMemory(unit);
      return unit;
  }

  async summarizeToolOutput(toolName: string, args: any, output: string, turnId: number, taskId: string, relatedId?: string): Promise<MemoryUnit> {
      const summary = await this.generateSummary('tool', output, `Tool: ${toolName}, Args: ${JSON.stringify(args)}`);
      Logger.llmResponse('memory', `工具输出摘要 (轮次 ${turnId}, 工具: ${toolName}): "${summary}"`, '记忆摘要-工具');
      const unit: MemoryUnit = {
          id: Math.random().toString(36).substring(2, 10),
          turnId,
          role: 'tool',
          summary,
          content: output,
          toolName,
          toolArgs: args,
          timestamp: Date.now(),
          relatedId,
          taskId
      };
      this.addMemory(unit);
      return unit;
  }

  async summarizeAssistantReply(content: string, turnId: number, taskId: string): Promise<MemoryUnit> {
      const summary = await this.generateSummary('assistant', content);
      Logger.llmResponse('memory', `助手回复摘要 (轮次 ${turnId}): "${summary}"`, '记忆摘要-助手');
      const unit: MemoryUnit = {
          id: Math.random().toString(36).substring(2, 10),
          turnId,
          role: 'assistant',
          summary,
          content,
          timestamp: Date.now(),
          taskId
      };
      this.addMemory(unit);
      return unit;
  }

  async retrieveContext(userQuery: string, taskId: string): Promise<string> {
    if (this.memoryStream.length === 0) return "";

    // 1. 获取当前任务的上下文
    const taskMemories = this.memoryStream.filter(u => u.taskId === taskId);
    
    // 2. 获取最近的全局上下文 (Cross-task context)
    // 即使 taskId 变了，我们也需要最近的 N 条对话来理解代词（如"它"、"上一个"）
    // 取最近 10 条记录作为全局上下文窗口
    const recentGlobalMemories = this.memoryStream.slice(-10);

    // 合并并去重
    const memoryMap = new Map<string, MemoryUnit>();
    [...taskMemories, ...recentGlobalMemories].forEach(m => memoryMap.set(m.id, m));
    
    // 转换为数组并按时间排序
    const relevantMemories = Array.from(memoryMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    if (relevantMemories.length === 0) return "";

    const summaryList = relevantMemories.map((u, index) => {
        const taskTag = u.taskId !== taskId ? `[History]` : `[Current]`;
        return `ID: ${u.id}：${taskTag} [${u.role.toUpperCase()}] (Turn ${u.turnId}) ${u.summary}`;
    }).join('\n');

    const prompt = `
你是一个记忆检索专家。基于用户的最新问题，从历史摘要中找出**必须回溯细节**才能回答的条目。
用户问题：${userQuery}

历史摘要：
${summaryList}

判断标准：
1. 优先关注 [Current] 任务中的信息。
2. 如果 [History] (上一任务) 中包含用户指代的对象（如"那个代码"、"上一个错误"），必须选中。
3. 如果摘要提到“代码”、“文件内容”、“错误日志”，且与问题相关，必须选中。
4. 只选最有用的 1-3 条。不要选无关的闲聊。
5. 如果没有相关的，返回空列表。

输出格式 (JSON):
{
  "relevant_ids": ["id1", "id2"]
}
`;

    let relevantIds: string[] = [];
    try {
        const response = await this.llm.chat([{ role: 'user', content: prompt }], undefined, undefined, "记忆检索-短期");
        const raw = response.content || "{}";
        Logger.llmResponse('memory', raw, '记忆检索-短期'); // Log raw LLM output

        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.relevant_ids)) {
                relevantIds = parsed.relevant_ids;
            }
        }
    } catch (e) {
        Logger.warn("Memory", "检索相关上下文失败");
    }

    if (relevantIds.length === 0) {
        Logger.info("Memory", "未找到相关上下文，查询: " + userQuery);
        return "";
    }

    const contextParts = relevantIds.map(id => {
        // Find in our merged map/list
        const unit = relevantMemories.find(u => u.id === id);
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

    Logger.info("Memory", `检索到 ${relevantIds.length} 条相关上下文，查询: "${userQuery}"`);
    Logger.info("Memory", `检索到的 ID: ${relevantIds.join(', ')}`);
    return contextParts.join('\n');
  }
}
