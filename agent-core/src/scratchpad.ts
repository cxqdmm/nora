
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { Logger } from './logger.js';

export interface ScratchpadEntry {
  key: string;
  value: string;
  timestamp: number;
}

export class ScratchpadManager {
  // Map<TaskId, Map<Key, Entry>>
  private store: Map<string, Map<string, ScratchpadEntry>> = new Map();

  constructor() {}

  private getTaskStore(taskId: string): Map<string, ScratchpadEntry> {
    if (!this.store.has(taskId)) {
      this.store.set(taskId, new Map());
    }
    return this.store.get(taskId)!;
  }

  /**
   * Update or Add a key-value pair to the scratchpad for a specific task
   */
  update(taskId: string, key: string, value: string) {
    const taskStore = this.getTaskStore(taskId);
    taskStore.set(key, {
      key,
      value,
      timestamp: Date.now()
    });
    Logger.scratchpadUpdate(this.getFormattedContent(taskId));
  }

  /**
   * Delete a key from the scratchpad for a specific task
   */
  delete(taskId: string, key: string) {
    const taskStore = this.getTaskStore(taskId);
    taskStore.delete(key);
    Logger.scratchpadUpdate(this.getFormattedContent(taskId));
  }

  /**
   * Get formatted text representation of the scratchpad for LLM context
   */
  getFormattedContent(taskId: string): string {
    const taskStore = this.getTaskStore(taskId);
    if (taskStore.size === 0) {
      return ""; // Return empty if no content
    }

    const entries = Array.from(taskStore.values())
      .sort((a, b) => a.timestamp - b.timestamp); // Keep chronological order

    const lines = entries.map(e => `- ${e.key}: "${e.value}"`);
    
    return `【全局任务白板 (Scratchpad)】\n(用于存储跨步骤的关键信息、中间结果或变量)\n${lines.join('\n')}`;
  }

  /**
   * Get the tool definition for LLM
   */
  getToolDefinition(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "manage_scratchpad",
        description: "管理全局任务白板(Scratchpad)。用于记录、更新或删除跨步骤需要的关键信息（如文件路径、分析结论、ID等）。当你完成一个步骤并产出重要中间结果时，务必使用此工具记录，以防遗忘。",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["update", "delete"],
              description: "操作类型：update(新增或修改), delete(删除)"
            },
            key: {
              type: "string",
              description: "信息的键名（简短描述，如 'analysis_result', 'target_path'）"
            },
            value: {
              type: "string",
              description: "信息的内容（仅当 action=update 时需要）。请保持简洁。"
            }
          },
          required: ["action", "key"]
        }
      }
    };
  }

  /**
   * Execute the tool logic
   */
  handleToolCall(taskId: string, args: any): string {
    const { action, key, value } = args;

    if (!key) {
      throw new Error("Key is required for scratchpad operation");
    }

    if (action === 'update') {
      if (value === undefined || value === null) {
        throw new Error("Value is required for update action");
      }
      this.update(taskId, key, value);
      return `Scratchpad updated: [${key}] = "${value}"`;
    } else if (action === 'delete') {
      this.delete(taskId, key);
      return `Scratchpad key deleted: [${key}]`;
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Clear all content for a task (or all tasks if no ID provided)
   */
  clear(taskId?: string) {
    if (taskId) {
        this.store.delete(taskId);
    } else {
        this.store.clear();
    }
  }
}
