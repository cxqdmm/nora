
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { Logger } from './logger.js';
import { PlanStep } from './planner.js';

export interface TodoItem {
  id: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
}

export class TodoManager {
  private store: Map<string, TodoItem[]> = new Map();

  constructor() {}

  /**
   * Initialize todo list from plan steps
   */
  initialize(taskId: string, steps: PlanStep[]) {
    const todos: TodoItem[] = steps.map(step => ({
      id: step.id,
      description: step.description,
      status: 'pending'
    }));
    this.store.set(taskId, todos);
    Logger.runningSummaryUpdate(this.getFormattedContent(taskId), taskId);
  }

  /**
   * Update status of a todo item
   */
  update(taskId: string, stepId: number, status: TodoItem['status'], result?: string) {
    const todos = this.store.get(taskId);
    if (!todos) {
        throw new Error(`No todo list found for task ${taskId}`);
    }

    const todo = todos.find(t => t.id === stepId);
    if (!todo) {
        throw new Error(`Todo item with ID ${stepId} not found`);
    }

    todo.status = status;
    if (result) {
        todo.result = result;
    }

    // Auto-update "in_progress" logic:
    // If a task is marked in_progress, others should probably not be? 
    // For now, let's trust the agent. But if marked completed, maybe check if next exists?
    
    Logger.runningSummaryUpdate(this.getFormattedContent(taskId), taskId);
  }

  getFormattedContent(taskId: string): string {
    const todos = this.store.get(taskId);
    if (!todos || todos.length === 0) return "";

    const lines = todos.map(t => {
        let icon = "[ ]";
        if (t.status === 'in_progress') icon = "[➜]";
        if (t.status === 'completed') icon = "[✓]";
        if (t.status === 'failed') icon = "[✗]";
        
        let line = `${icon} Step ${t.id}: ${t.description}`;
        if (t.result) {
            line += `\n    Result: ${t.result}`;
        }
        return line;
    });

    // Calculate progress
    const completed = todos.filter(t => t.status === 'completed').length;
    const total = todos.length;
    const progress = Math.round((completed / total) * 100);

    return `【任务进度 (Progress: ${progress}%)】\n${lines.join('\n')}`;
  }

  getToolDefinition(): ChatCompletionTool {
    return {
      type: "function",
      function: {
        name: "update_todo",
        description: "更新任务步骤的执行状态。每当你开始、完成或失败一个步骤时，必须调用此工具。这取代了之前的 running summary。",
        parameters: {
          type: "object",
          properties: {
            step_id: {
              type: "number",
              description: "步骤 ID (对应计划中的 ID)"
            },
            status: {
              type: "string",
              enum: ["in_progress", "completed", "failed"],
              description: "新的状态"
            },
            result: {
              type: "string",
              description: "步骤执行结果的简要说明（仅当 completed/failed 时建议提供）"
            }
          },
          required: ["step_id", "status"]
        }
      }
    };
  }

  handleToolCall(taskId: string, args: any): string {
    const { step_id, status, result } = args;
    this.update(taskId, step_id, status, result);
    return `Todo item ${step_id} updated to ${status}.`;
  }
}
