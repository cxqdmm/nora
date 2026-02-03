import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMService } from './llm-service.js';
import { MCPManager } from './mcp-manager.js';
import { Planner, Plan } from './planner.js';

const SYSTEM_PROMPT = `
You are an advanced AI Agent with access to a set of tools.

**Capabilities:**
1. You can write and execute Python code (via \`execute_code\`) for calculation and data processing.
2. You can perform filesystem operations (read/write/list) via provided tools.

**CRITICAL RULES:**
1. **Python Execution**: ALWAYS use \`print(...)\` to output the final result.
2. **Filesystem**: Use absolute paths or paths relative to the allowed root.
3. **General**: Interpret tool outputs and provide a clear final answer.

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
        console.error(`[Agent] Failed to list tools from one of the MCP servers:`, e);
      }
    }
    console.log(`[Agent] Initialized with tools: ${this.tools.map(t => t.function.name).join(', ')}`);
  }

  async chat(userInput: string): Promise<string> {
    // 1. Plan Phase
    console.log("\n--- Planning Phase ---");
    let plan: Plan | null = null;
    try {
      plan = await this.planner.createPlan(userInput);
      console.log(`[Agent] Plan Generated: ${plan.reasoning}`);
      plan.steps.forEach(step => console.log(`  - Step ${step.id}: ${step.description} [${step.tool || 'internal'}]`));
    } catch (e) {
      console.warn("[Agent] Planning failed, falling back to direct execution.", e);
    }

    // 2. Execution Phase
    console.log("\n--- Execution Phase ---");
    
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
      console.log(`[Agent] Thinking... (Turn ${turnCount})`);

      const response = await this.llm.chat(this.history, this.tools);
      this.history.push(response);

      // Check if LLM wants to call a tool
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          console.log(`[Agent] Executing tool: ${toolCall.function.name}`);
          
          let args;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            console.error(`[Agent] Failed to parse arguments for tool ${toolCall.function.name}`);
            this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: "Error: Invalid JSON arguments provided."
            });
            continue;
          }

          // Find correct MCP manager for this tool
          const mcp = this.toolMap.get(toolCall.function.name);
          if (!mcp) {
             console.error(`[Agent] Tool ${toolCall.function.name} not found in any MCP server.`);
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
            console.log(`[Agent] Tool Output:\n${contentText.trim().substring(0, 200)}${contentText.length > 200 ? '...' : ''}`);

            this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: contentText || "(Tool executed successfully with no text output)"
            });
          } catch (error: any) {
            console.error(`[Agent] Tool execution failed: ${error.message}`);
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
