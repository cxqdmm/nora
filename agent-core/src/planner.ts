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
You are a strategic Planner Agent. Your goal is to break down complex user requests into a sequence of executable steps.

**Available Tools:**
- \`execute_code\`: Run Python code for calculation, data processing, or logic.

**Output Format:**
You must output a valid JSON object with the following structure:
\`\`\`json
{
  "reasoning": "Explanation of the plan strategy...",
  "steps": [
    {
      "id": 1,
      "description": "Step description...",
      "tool": "execute_code"
    },
    ...
  ]
}
\`\`\`

**Rules:**
1. Keep steps atomic and clear.
2. Ensure logical order (dependencies are implicit in the sequence for now).
3. If the user request is simple (single step), return a plan with just one step.
4. Do NOT execute the steps yourself, just plan them.
`;

export class Planner {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  async createPlan(userGoal: string): Promise<Plan> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      { role: "user", content: `Create a plan for: "${userGoal}"` }
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
