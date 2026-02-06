import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMService } from './llm-service.js';
import { MCPManager } from './mcp-manager.js';

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
- \`search_memories\`：搜索长期记忆库。
- \`read_memory\`：读取具体记忆内容的详细信息。
- \`store_memory\`：存储新的重要记忆。
- \`read_file\` / \`write_file\` / \`list_directory\`：文件系统操作。

**输出格式：**
你必须输出一个符合以下结构的有效 JSON 对象：
\`\`\`json
{
  "reasoning": "分析是否需要规划以及策略解释...",
  "steps": [
    {
      "id": 1,
      "description": "步骤描述...",
      "tool": "execute_code"
    }
  ]
}
\`\`\`

**规则：**
1. **先判断复杂度**：
   - 如果用户请求是**简单**的（例如：问候、单一问题、简单的直接命令、闲聊），不需要多步执行，请将 steps 设置为空数组 []，并在 reasoning 中说明“这是一个简单请求，直接回答即可”。
   - 如果用户请求是**复杂**的（需要多步推理、工具组合、查找资料后处理等），则生成具体的 steps。
2. 保持步骤原子化且清晰。
3. 确保逻辑顺序（依赖关系隐含在顺序中）。
4. 不要自己执行步骤，只负责规划。
5. **记忆检索优先原则**：如果用户的问题涉及“过去”、“回忆”、“记得”、“查找历史”等意图，或者涉及未知的上下文信息，**必须**将调用 search_memories 作为计划的第一步。
`;

export class Planner {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  async createPlan(userGoal: string, history: ChatCompletionMessageParam[] = [], tools: ChatCompletionTool[] = []): Promise<Plan> {
    // Filter out system messages from history to avoid conflicting instructions
    const contextMessages = history.filter(msg => msg.role !== 'system');

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      ...contextMessages,
      { 
        role: "user", 
        content: `用户当前的输入是: "${userGoal}"\n\n请根据上述上下文和用户输入，判断这是否需要一个复杂的执行计划。如果需要，请制定详细的执行步骤；如果这是一个简单的交互（如问候、澄清、单一问题），请返回空步骤列表。` 
      }
    ];

    console.log(`[Planner] Creating plan for: "${userGoal}"`);
    
    // Pass tools to LLM but force tool_choice to "none" to ensure we get a JSON plan, not a tool call
    // However, providing tools allows the LLM to understand what capabilities are available.
    const response = await this.llm.chat(messages, tools, "none", "Planner");
    
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
