
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { Logger } from './logger.js';

export interface RunningSummary {
  done: string[];
  doing: string;
  next: string;
  blockers?: string;
  timestamp: number;
}

export class RunningSummaryManager {
  private store: Map<string, RunningSummary> = new Map();

  constructor() {}

  update(taskId: string, summary: Partial<RunningSummary>) {
    const existing = this.store.get(taskId) || {
      done: [],
      doing: "",
      next: "",
      blockers: "",
      timestamp: Date.now()
    };

    this.store.set(taskId, {
      ...existing,
      ...summary,
      timestamp: Date.now()
    });
    Logger.runningSummaryUpdate(this.getFormattedContent(taskId));
  }

  getFormattedContent(taskId: string): string {
    const summary = this.store.get(taskId);
    if (!summary) return "";

    return `【任务进度摘要 (Running Summary)】
- 已完成 (Done): ${summary.done.length > 0 ? summary.done.join('; ') : '无'}
- 进行中 (Doing): ${summary.doing || '无'}
- 下一步 (Next): ${summary.next || '无'}
${summary.blockers ? `- 阻塞点 (Blockers): ${summary.blockers}` : ''}
`;
  }

  getToolDefinition(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "update_running_summary",
        description: "更新当前任务的进度摘要。每当完成一个重要步骤或任务状态发生变化时，务必调用此工具。这有助于保持对长任务的跟踪。",
        parameters: {
          type: "object",
          properties: {
            done: {
              type: "array",
              items: { type: "string" },
              description: "已完成的关键步骤列表（请追加新完成的项）"
            },
            doing: {
              type: "string",
              description: "当前正在进行的具体工作"
            },
            next: {
              type: "string",
              description: "下一步的计划"
            },
            blockers: {
              type: "string",
              description: "遇到的阻塞或问题（可选）"
            }
          },
          required: ["doing", "next"]
        }
      }
    };
  }

  handleToolCall(taskId: string, args: any): string {
    this.update(taskId, args);
    return "Running Summary updated successfully.";
  }

  clear(taskId?: string) {
    if (taskId) {
      this.store.delete(taskId);
    } else {
      this.store.clear();
    }
  }
}
