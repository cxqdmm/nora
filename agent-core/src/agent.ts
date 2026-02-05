import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMService } from './llm-service.js';
import { MCPManager } from './mcp-manager.js';
import { Planner, Plan } from './planner.js';
import { Logger } from './logger.js';

const SYSTEM_PROMPT = `
你是一个拥有多种工具的高级 AI Agent。

**能力：**
1. 你可以编写并执行 Python 代码（通过 \`execute_code\`）进行计算和数据处理。
2. 你可以通过提供的工具执行文件系统操作（读取/写入/列出）。
3. 你拥有**长期记忆**系统。你可以使用 \`search_memories\`、\`read_memory\` 和 \`store_memory\` 来搜索、读取和存储记忆。

**关键规则：**
1. **Python 执行**：必须始终使用 \`print(...)\` 输出最终结果。
2. **文件系统**：使用绝对路径或相对于允许根目录的路径。
3. **通用**：解释工具输出并提供清晰的最终答案。

**记忆整合策略（重要）：**
在每个复杂任务或重要交互结束时，你必须反思这段对话。
问自己：“这里有什么高价值的信息是我应该为未来记住的吗？”
- **高价值信息包括**：
    - Bug 修复及其根本原因。
    - 用户偏好（例如，“我更喜欢 TypeScript 而不是 JS”）。
    - 成功的代码模式或架构决策。
    - 有效的复杂命令序列。
- 如果是，你必须使用 \`store_memory\` 工具保存结构化的记忆（Markdown 格式）。
- **不要请求用户保存许可**，如果它有价值，请主动保存。
- 保存后，告知用户：“我已将此解决方案/偏好保存到我的长期记忆中，以供将来参考。”

**交互风格：**
- 以规划器（Planner）的计划为指导。
- 顺序执行工具。
- 如果工具失败，分析错误并重试或调整计划。
`;

export class Agent {
  private mcps: MCPManager[];
  private llm: LLMService;
  private planner: Planner;
  private history: ChatCompletionMessageParam[] = [];
  private tools: ChatCompletionTool[] = [];
  private toolMap: Map<string, MCPManager> = new Map();

  constructor(mcps: MCPManager[], llm: LLMService) {
    this.mcps = mcps;
    this.llm = llm;
    this.planner = new Planner(llm);
    
    // Initialize history with system prompt
    this.history.push({
      role: "system",
      content: SYSTEM_PROMPT
    });
  }

  async initialize() {
    this.tools = [];
    this.toolMap.clear();

    for (const mcp of this.mcps) {
      try {
        const mcpTools = await mcp.listTools();
        for (const tool of mcpTools.tools) {
          this.tools.push({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description || "",
              parameters: tool.inputSchema as any
            }
          });
          this.toolMap.set(tool.name, mcp);
        }
      } catch (e) {
        Logger.error("Agent", `Failed to list tools from one of the MCP servers: ${e}`);
      }
    }
    Logger.info("Agent", `Initialized with tools: ${this.tools.map(t => (t as any).function.name).join(', ')}`);
  }

  async chat(userInput: string): Promise<string> {
    // 1. Plan Phase
    Logger.info("Phase", "Planning");
    let plan: Plan | null = null;
    try {
      plan = await this.planner.createPlan(userInput, this.history);
      Logger.success("Plan", plan.reasoning);
      plan.steps.forEach(step => Logger.info("Step", `${step.id}: ${step.description}`));
    } catch (e) {
      Logger.warn("Plan", "Planning failed, falling back to direct execution.");
    }

    // 2. Execution Phase
    Logger.info("Phase", "Execution");
    
    // Inject Plan into Context
    if (plan) {
      this.history.push({
        role: "system",
        content: `当前计划:\n${JSON.stringify(plan.steps, null, 2)}\n\n请按顺序执行这些步骤以回答用户请求。`
      });
    }

    // Add user message to history
    this.history.push({ role: "user", content: userInput });

    let finalAnswer = "";
    let turnCount = 0;
    const MAX_TURNS = 15;

    while (turnCount < MAX_TURNS) {
      turnCount++;
      Logger.info("Turn", `${turnCount} Thinking...`);

      const response = await this.llm.chat(this.history, this.tools);
      this.history.push(response);

      // Check if LLM wants to call a tool
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          Logger.info("Tool", `Executing: ${(toolCall as any).function.name}`);
          
          let args;
          try {
            args = JSON.parse((toolCall as any).function.arguments);
            Logger.info("Args", JSON.stringify(args));
          } catch (e) {
            Logger.error("Tool", `Failed to parse arguments for ${(toolCall as any).function.name}`);
            this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: "Error: Invalid JSON arguments provided."
            });
            continue;
          }

          // Special Logging for execute_code
          if ((toolCall as any).function.name === 'execute_code' && args.code) {
            Logger.code(args.code);
          }

          // Find correct MCP manager for this tool
          const mcp = this.toolMap.get((toolCall as any).function.name);
          if (!mcp) {
             Logger.error("Tool", `${(toolCall as any).function.name} not found in any MCP server.`);
             this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error: Tool ${(toolCall as any).function.name} not found.`
            });
            continue;
          }

          try {
            const toolResult = await mcp.callTool((toolCall as any).function.name, args);
            
            // Format output
            const contentText = toolResult.content.map((c: any) => c.type === 'text' ? c.text : '').join("\n");
            
            Logger.toolOutput(contentText);

            this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: contentText || "(Tool executed successfully with no text output)"
            });
          } catch (error: any) {
            Logger.error("Tool", `Execution failed: ${error.message}`);
            this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error executing tool: ${error.message}`
            });
          }
        }
      } else {
        // No tool calls, this is the final answer
        finalAnswer = response.content || "";
        break;
      }
    }

    return finalAnswer;
  }
}
