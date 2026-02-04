import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMService } from './llm-service.js';
import { MCPManager } from './mcp-manager.js';
import { Planner, Plan } from './planner.js';
import { Logger } from './logger.js';

const SYSTEM_PROMPT = `
You are an advanced AI Agent with access to a set of tools.

**Capabilities:**
1. You can write and execute Python code (via \`execute_code\`) for calculation and data processing.
2. You can perform filesystem operations (read/write/list) via provided tools.
3. You have a **Long-term Memory** system. You can search, read, and store memories using \`search_memories\`, \`read_memory\`, and \`store_memory\`.

**CRITICAL RULES:**
1. **Python Execution**: ALWAYS use \`print(...)\` to output the final result.
2. **Filesystem**: Use absolute paths or paths relative to the allowed root.
3. **General**: Interpret tool outputs and provide a clear final answer.

**MEMORY CONSOLIDATION POLICY (IMPORTANT):**
At the end of every complex task or significant interaction, you MUST reflect on the conversation.
Ask yourself: "Is there any high-value information here that I should remember for the future?"
- **High-value information includes**: 
    - Bug fixes and their root causes.
    - User preferences (e.g., "I prefer TypeScript over JS").
    - Successful code patterns or architectural decisions.
    - Complex command sequences that worked.
- If YES, you MUST use the \`store_memory\` tool to save a structured memory (Markdown format).
- **Do not ask the user for permission to save**, just do it proactively if it's valuable.
- After saving, inform the user: "I've saved this solution/preference to my long-term memory for future reference."

**Interaction Style:**
- Use the Planner's plan as a guide.
- Execute tools sequentially.
- If a tool fails, analyze the error and retry or adjust the plan.
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
    Logger.info("Agent", `Initialized with tools: ${this.tools.map(t => t.function.name).join(', ')}`);
  }

  async chat(userInput: string): Promise<string> {
    // 1. Plan Phase
    Logger.info("Phase", "Planning");
    let plan: Plan | null = null;
    try {
      plan = await this.planner.createPlan(userInput);
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
        content: `Current Plan:\n${JSON.stringify(plan.steps, null, 2)}\n\nExecute these steps sequentially to answer the user request.`
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
          Logger.info("Tool", `Executing: ${toolCall.function.name}`);
          
          let args;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            Logger.error("Tool", `Failed to parse arguments for ${toolCall.function.name}`);
            this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: "Error: Invalid JSON arguments provided."
            });
            continue;
          }

          // Special Logging for execute_code
          if (toolCall.function.name === 'execute_code' && args.code) {
            Logger.code(args.code);
          }

          // Find correct MCP manager for this tool
          const mcp = this.toolMap.get(toolCall.function.name);
          if (!mcp) {
             Logger.error("Tool", `${toolCall.function.name} not found in any MCP server.`);
             this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error: Tool ${toolCall.function.name} not found.`
            });
            continue;
          }

          try {
            const toolResult = await mcp.callTool(toolCall.function.name, args);
            
            // Format output
            const contentText = toolResult.content.map(c => c.type === 'text' ? c.text : '').join("\n");
            
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
