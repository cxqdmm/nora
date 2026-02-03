import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMService } from './llm-service.js';
import { MCPManager } from './mcp-manager.js';
import { Planner, Plan } from './planner.js';

const SYSTEM_PROMPT = `
You are an advanced AI Agent with access to a Python Sandbox environment.

**Capabilities:**
1. You can write and execute Python code to solve computational problems, data processing tasks, or general scripting.
2. You have access to a persistent Python environment (variables are preserved between executions in the same session, if supported by the sandbox - currently assume stateless for safety unless specified).

**CRITICAL RULES for Python Execution:**
1. **ALWAYS use \`print(...)\` to output the final result.** The sandbox only captures \`stdout\` and \`stderr\`. If you calculate a value but don't print it, you will see no output.
2. Do not rely on return values of the code block.
3. Write complete, valid Python scripts.

**Interaction Style:**
- When a user asks a question that requires calculation or code, IMMEDIATELY generate a tool call to \`execute_code\`.
- After receiving the tool output, interpret it and answer the user's question.
- If the tool output is empty or indicates an error, analyze why (e.g., forgot to print) and try again or explain the error.
`;

export class Agent {
  private mcp: MCPManager;
  private llm: LLMService;
  private planner: Planner;
  private history: ChatCompletionMessageParam[] = [];
  private tools: ChatCompletionTool[] = [];

  constructor(mcp: MCPManager, llm: LLMService) {
    this.mcp = mcp;
    this.llm = llm;
    this.planner = new Planner(llm);
    
    // Initialize history with system prompt
    this.history.push({
      role: "system",
      content: SYSTEM_PROMPT
    });
  }

  async initialize() {
    // Load tools from MCP
    const mcpTools = await this.mcp.listTools();
    this.tools = mcpTools.tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.inputSchema as any
      }
    }));
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

    // Add user message to history (or reference the plan)
    this.history.push({ role: "user", content: userInput });

    let finalAnswer = "";
    let turnCount = 0;
    const MAX_TURNS = 10; // Increased for multi-step plans

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

          try {
            const toolResult = await this.mcp.callTool(toolCall.function.name, args);
            
            // Format output
            const contentText = toolResult.content.map(c => c.type === 'text' ? c.text : '').join("\n");
            console.log(`[Agent] Tool Output:\n${contentText.trim().substring(0, 200)}${contentText.length > 200 ? '...' : ''}`);

            this.history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: contentText || "(No output captured. Did you forget to print?)"
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
