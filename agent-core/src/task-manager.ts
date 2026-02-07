
import { randomUUID } from 'crypto';

export interface Task {
  id: string;
  title: string;
  status: 'active' | 'completed' | 'paused';
  createdAt: number;
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private currentTaskId: string | null = null;

  constructor() {}

  createTask(title: string): Task {
    const id = randomUUID();
    const task: Task = {
      id,
      title,
      status: 'active',
      createdAt: Date.now()
    };
    this.tasks.set(id, task);
    this.currentTaskId = id; // Auto-switch to new task
    return task;
  }

  switchTask(taskId: string): boolean {
    if (this.tasks.has(taskId)) {
      this.currentTaskId = taskId;
      return true;
    }
    return false;
  }

  updateTaskTitle(taskId: string, title: string): boolean {
    const task = this.tasks.get(taskId);
    if (task) {
      task.title = title;
      return true;
    }
    return false;
  }

  getCurrentTask(): Task | null {
    if (!this.currentTaskId) return null;
    return this.tasks.get(this.currentTaskId) || null;
  }

  getCurrentTaskId(): string {
    // If no task exists, create a default one
    if (!this.currentTaskId) {
      this.createTask("Default Task");
    }
    return this.currentTaskId!;
  }

  listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
}
