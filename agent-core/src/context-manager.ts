import { Logger } from './logger.js';
import { LLMService } from './llm-service.js';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import * as fs from 'fs';
import * as path from 'path';

export class MemoryManager {
  private summary: string = "";
  private llm: LLMService;
  private readonly memoryBaseDir: string;
  private readonly shortTermDir: string;

  constructor(llm: LLMService) {
    this.llm = llm;
    // Base memory directory
    this.memoryBaseDir = path.join(process.cwd(), '..', 'memorys'); // Assuming agent-core is sibling to memorys or inside project root. 
    // Let's adjust path logic to be safe. User said "/Users/mac/Documents/cxq/nora/memorys/memories/..."
    // Current CWD is "/Users/mac/Documents/cxq/nora"
    // So 'memorys' is in project root.
    this.memoryBaseDir = path.join(process.cwd(), 'memorys');

    this.shortTermDir = path.join(this.memoryBaseDir, 'short-memorys');
    
    if (!fs.existsSync(this.shortTermDir)) {
      fs.mkdirSync(this.shortTermDir, { recursive: true });
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private async archiveMessages(messages: ChatCompletionMessageParam[], summaryContext: string) {
    if (messages.length === 0) return;

    try {
      // 1. Prepare Content
      const conversationText = messages.map(m => {
        const content = typeof m.content === 'string' ? m.content : '[Complex Content]';
        return `**${m.role.toUpperCase()}**: ${content}`;
      }).join('\n\n');

      // 2. Generate Metadata via LLM
      const archivePrompt = `
你是一个专业的记忆归档员。
你的任务是将一段原始对话转化为一篇结构清晰的“知识文档”。
请不要保留原始对话的 User/Assistant 格式，而是将其重写为第三人称的叙述性文档。

对话片段：
"""
${conversationText.substring(0, 3000)} ... (只截取前3000字符用于分析)
"""

上下文摘要（供参考）：
"""
${summaryContext}
"""

任务：
1. 为这段对话生成一个简短标题（title）。
2. 生成一段简明扼要的描述（description），概括这段对话解决了什么问题或讨论了什么内容。
3. 提取3-5个关键标签（tags）。
4. 评估其重要性（importance，1-10分）。
5. **核心任务**：将原始对话重写为一篇结构化的“知识文档”（markdown content）。
   - 包含：背景/问题描述、关键决策过程、最终解决方案/代码片段、已验证的结论。
   - 去除：所有闲聊、重复尝试的中间过程、无效的工具调用。
   - 风格：客观、技术性、简洁。

输出格式 (JSON):
{
  "title": "...",
  "description": "...",
  "tags": ["...", "..."],
  "importance": 5,
  "content": "这里是重写后的 Markdown 文档内容..."
}
`;
      
      let metadata = {
        title: "未命名归档",
        description: "无描述",
        tags: ["归档"],
        importance: 1,
        content: conversationText // Fallback to raw text if generation fails
      };

      try {
        const rawRes = await this.llm.simpleChat(archivePrompt);
        const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            metadata = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        Logger.warn("Memory", "Failed to generate archive metadata, using default.");
      }

      // 3. Construct File Path
      // Format: short-memorys/YYYY-MM-DD/HH/timestamp_id_title.md
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const hourStr = String(now.getHours()).padStart(2, '0');
      const timeStr = now.toISOString().replace(/[:.]/g, '').split('T')[1].substring(0, 6); // HHMMSS
      const id = this.generateId();
      
      const dirPath = path.join(this.shortTermDir, dateStr, hourStr);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const fileName = `${dateStr.replace(/-/g, '')}${timeStr}_${id}_${metadata.title.replace(/[\/\\:\*\?"<>\|]/g, '_')}.md`;
      const filePath = path.join(dirPath, fileName);

      // 4. Create Markdown Content
      const mdContent = `---
id: "${id}"
type: "short_term_archive"
created_at: "${now.toISOString()}"
title: "${metadata.title}"
description: "${metadata.description}"
tags: ${JSON.stringify(metadata.tags)}
importance: ${metadata.importance}
---

## 知识归档

${metadata.content}
`;

      // 5. Write File
      fs.writeFileSync(filePath, mdContent);
      Logger.info("Memory", `Archived ${messages.length} messages to ${filePath}`);

    } catch (e: any) {
      Logger.error("Memory", `Failed to archive messages: ${e.message}`);
    }
  }

  async getShortTermSummaries(): Promise<any[]> {
    const summaries: any[] = [];
    
    // Recursive function to walk directories
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walk(filePath);
        } else if (file.endsWith('.md')) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            // Extract frontmatter
            const idMatch = content.match(/id: "(.*?)"/);
            const titleMatch = content.match(/title: "(.*?)"/);
            const descMatch = content.match(/description: "(.*?)"/);
            const tagsMatch = content.match(/tags: (\[.*?\])/);
            
            if (idMatch && titleMatch) {
              summaries.push({
                id: idMatch[1],
                title: titleMatch[1],
                description: descMatch ? descMatch[1] : "",
                tags: tagsMatch ? JSON.parse(tagsMatch[1]) : [],
                source: 'short_term',
                type: 'short_term_archive'
              });
            }
          } catch (e) {
            Logger.warn("Memory", `Failed to parse short-term memory file ${file}: ${e}`);
          }
        }
      }
    };

    walk(this.shortTermDir);
    return summaries;
  }

  async readShortTermMemory(id: string): Promise<string | null> {
    let foundContent: string | null = null;
    
    const walk = (dir: string) => {
      if (foundContent) return; // Stop if found
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          walk(filePath);
        } else if (file.endsWith('.md')) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.includes(`id: "${id}"`)) {
               foundContent = content;
               return;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    };

    walk(this.shortTermDir);
    return foundContent;
  }

  async consolidateMemory(history: ChatCompletionMessageParam[], maxHistoryLength: number, keepRecentCount: number) {
    // If history is within limits, do nothing
    if (history.length <= maxHistoryLength) return;

    Logger.info("Memory", `History length (${history.length}) exceeded limit (${maxHistoryLength}). Initiating memory consolidation...`);

    // 1. Identify the chunk to prune (skip system prompt at index 0)
    // We want to process EVERYTHING except the System Prompt and the Recent Context
    const startIndex = 1; 
    const endIndex = history.length - keepRecentCount;
    
    // Safety check
    if (startIndex >= endIndex) {
       Logger.warn("Memory", "History is full but recent buffer takes up all space. Cannot prune yet.");
       return;
    }

    const messagesToPrune = history.slice(startIndex, endIndex);

    // 2. Prepare text for summarization
    const conversationText = messagesToPrune.map(m => {
      const content = typeof m.content === 'string' ? m.content : '[Complex Content]';
      return `${m.role.toUpperCase()}: ${content}`;
    }).join('\n\n');

    // 3. Prompt for LLM
    const consolidationPrompt = `
你是一个 AI Agent 的“工作记忆”管理器。
你的唯一任务是维护一个极简的、仅与**当前未完成任务**相关的上下文摘要。

当前累计摘要（可能包含已过时的信息）：
"""
${this.summary}
"""

新对话片段（刚刚发生的交互）：
"""
${conversationText}
"""

核心指令：
1. **聚焦当前任务**：仅保留为了完成“当前正在进行的任务”所必须的信息（如：当前需求、已确定的参数、下一步计划）。
2. **遗忘已完成**：如果之前的任务已经完成并归档（Archive），请在摘要中果断删除相关细节，只保留一句简短的“已完成X任务”作为背景。
3. **极度精简**：你的目标是让 Agent 在没有历史记录的情况下，仅凭这段摘要就能继续工作。不要保留任何冗余信息。

输出格式 (JSON):
{
  "updated_summary": "..."
}
`;

    // 4. Call LLM
    try {
      const rawResult = await this.llm.simpleChat(consolidationPrompt);
      
      // Clean up markdown code blocks if present
      const jsonStr = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonStr);

      // 5. Apply Updates
      
      // A. Update Summary
      if (result.updated_summary) {
        this.summary = result.updated_summary;
        this.broadcastUpdate();
      }

      // 6. Prune History
      const prunedCount = endIndex - startIndex;
      
      // Archive BEFORE pruning
      // Use the OLD summary for context when archiving this chunk
      await this.archiveMessages(messagesToPrune, this.summary);
      
      history.splice(startIndex, prunedCount);
      
      Logger.info("Memory", `Consolidated ${prunedCount} messages. New History Length: ${history.length}`);
      Logger.historyStats(history.length, maxHistoryLength);

    } catch (e: any) {
      Logger.error("Memory", `Consolidation failed: ${e.message}`);
    }
  }

  getPrompt(): string {
    if (!this.summary) return "";

    return `
=== 记忆摘要 (全局上下文) ===
以下是目前为止整个对话的精简摘要。请使用它来保持长期的连贯性。
${this.summary}
=======================================
`;
  }

  private broadcastUpdate() {
    // Send summary to UI
    Logger.contextUpdate([{ source: 'conversation_summary', content: this.summary, timestamp: Date.now() }]);
  }
}
