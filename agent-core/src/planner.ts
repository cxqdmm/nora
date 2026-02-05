import { LLMService } from './llm-service.js';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface PlanStep {
  id: number;
  description: string;
  tool?: string; // Suggested tool (optional)
  dependencies?: number[]; // IDs of steps that must be completed first
}

export interface Plan {
  steps: PlanStep[];
  reasoning: string;
}

const PLANNER_SYSTEM_PROMPT = `
你是一个战略规划 Agent。你的目标是将复杂的用户请求分解为一系列可执行的步骤。

**可用工具：**
- \`execute_code\`：运行 Python 代码进行计算、数据处理或逻辑运算。

**输出格式：**
你必须输出一个符合以下结构的有效 JSON 对象：
\`\`\`json
{
  "reasoning": "计划策略的解释...",
  "steps": [
    {
      "id": 1,
      "description": "步骤描述...",
      "tool": "execute_code"
    },
    ...
  ]
}
\`\`\`

**规则：**
1. 保持步骤原子化且清晰。
2. 确保逻辑顺序（依赖关系隐含在顺序中）。
3. 如果用户请求很简单（单一步骤），则返回仅包含一个步骤的计划。
4. 不要自己执行步骤，只负责规划。
`;

export class Planner {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  async createPlan(userGoal: string, history: ChatCompletionMessageParam[] = []): Promise<Plan> {
    // Filter out system messages from history to avoid conflicting instructions
    const contextMessages = history.filter(msg => msg.role !== 'system');

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      ...contextMessages,
      { role: "user", content: `为以下目标制定计划: "${userGoal}"` }
    ];

    console.log(`[Planner] Creating plan for: "${userGoal}"`);
    
    // We force JSON mode via prompt engineering (and potentially response_format if supported by model/provider)
    // Qwen/OpenAI compatible usually supports prompt-based JSON enforcement well.
    const response = await this.llm.chat(messages);
    
    const content = response.content || "{}";
    
    // Attempt to extract JSON if wrapped in markdown code blocks
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    try {
      const plan = JSON.parse(jsonStr) as Plan;
      return plan;
    } catch (e) {
      console.error("[Planner] Failed to parse plan JSON:", content);
      throw new Error("Failed to generate a valid plan.");
    }
  }
}
