import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMService } from './llm-service.js';
import { MCPManager } from './mcp-manager.js';
import { Planner, Plan } from './planner.js';
import { Logger } from './logger.js';
import { Memoryer } from './memoryer.js';
import { MemoryManager } from './context-manager.js';

const SYSTEM_PROMPT = `
你是一个拥有多种工具的高级 AI Agent。

**能力：**
1. 你可以编写并执行 Python 代码（通过 \`execute_code\`）进行计算和数据处理。
2. 你可以通过提供的工具执行文件系统操作（读取/写入/列出）。
3. 你拥有**长期记忆**系统。你可以使用 \`search_memories\`、\`read_memory\` 和 \`store_memory\` 来搜索、读取和存储记忆。
   - 当用户询问模糊的、过去的或你需要回忆的信息时，**必须**优先使用 \`search_memories\`。

**关键规则：**
1. **Python 执行**：必须始终使用 \`print(...)\` 输出最终结果。
2. **文件系统**：使用绝对路径或相对于允许根目录的路径。
3. **通用**：解释工具输出并提供清晰的最终答案。

**记忆整合策略（重要）：**
长期记忆（\`store_memory\`）只在用户**明确要求**时才使用。
- 如果用户明确说“请记住/保存/写入长期记忆/存档这段结论”，你才调用 \`store_memory\`。
- 否则不要主动将信息写入长期记忆。
- 用户询问过去信息时，仍可使用 \`search_memories\` / \`read_memory\` 检索与读取。

**交互风格：**
- 以规划器（Planner）的计划为指导。
- 顺序执行工具。
- 如果工具失败，分析错误并重试或调整计划。
`;

export class Agent {
  private mcps: MCPManager[];
  private llm: LLMService;
  private planner: Planner;
  private memoryer: Memoryer;
  private memoryManager: MemoryManager;
  private systemMessage: ChatCompletionMessageParam;
  private tools: ChatCompletionTool[] = [];
  private toolMap: Map<string, MCPManager> = new Map();
  private turnId = 0;

  constructor(mcps: MCPManager[], llm: LLMService) {
    this.mcps = mcps;
    this.llm = llm;
    this.planner = new Planner(llm);
    this.memoryer = new Memoryer(llm);
    this.memoryManager = new MemoryManager(llm);

    this.systemMessage = {
      role: "system",
      content: SYSTEM_PROMPT,
    };
  }

  async initialize() {
    this.tools = [];
    this.toolMap.clear();

    // 1. Add MCP Tools
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

    // 2. Discover Available Skills (Layer 1 Metadata)
    try {
      const skillsMcp = this.toolMap.get("list_skills"); // Check if 'list_skills' tool is available
      if (skillsMcp) {
        const result = await skillsMcp.callTool("list_skills", {});
        const contentText = (result as any).content[0].text;
        const skillsList = JSON.parse(contentText);
        
        if (skillsList.length > 0) {
          const skillsBlock = `
<available_skills>
${skillsList.map((s: any) => `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`).join("\n")}
</available_skills>

**技能调用协议 (SKILLS PROTOCOL - CRITICAL)**
你拥有专门的“技能 (Skills)”（标准作业程序），其中包含特定任务的专家级知识。
1. **检查 (CHECK)**：在每一轮对话开始时，检查用户的请求是否匹配 <available_skills> 中的任何技能。
2. **激活 (ACTIVATE)**：如果发现匹配，你必须**立即**调用 \`read_skill(name)\`。在读取技能之前，不要进行规划或执行其他工具。
3. **遵循 (FOLLOW)**：一旦加载了技能，请严格遵循其内部定义的程序执行。

示例：
用户：“帮我审查代码”
匹配：“git-code-review”（描述：分析变更...）
动作：调用 \`read_skill("git-code-review")\`
`;
          this.systemMessage.content += "\n\n" + skillsBlock;
          Logger.info("Agent", `Injected ${skillsList.length} skills into System Prompt.`);
        }
      }
    } catch (e) {
      Logger.warn("Agent", `Failed to inject skills metadata: ${e}`);
    }
  }

  async chat(userInput: string): Promise<string> {
    this.turnId += 1;
    const currentTurnId = this.turnId;

    // 1. Plan Phase
    Logger.phase("Planning");
    
    // List available tools for debugging/visibility
    const availableToolNames = this.tools.map(t => (t as any).function.name);
    Logger.info("Tools", `Available for planning: ${availableToolNames.join(', ')}`);

    let plan: Plan | null = null;
    try {
      const planningHistory: ChatCompletionMessageParam[] = [this.systemMessage];

      const dynamicContextForPlan = await this.memoryManager.retrieveContext(userInput);
      if (dynamicContextForPlan) {
        planningHistory.push({ role: "assistant", content: `【短期记忆召回】\n${dynamicContextForPlan}` });
      }
      
      plan = await this.planner.createPlan(userInput, planningHistory, this.tools);
      
      if (plan.steps && plan.steps.length > 0) {
        Logger.plan(plan.reasoning);
        plan.steps.forEach(step => Logger.step(step.id, step.description));
      } else {
        Logger.plan(`No complex plan needed: ${plan.reasoning}`);
      }
      
    } catch (e) {
      Logger.warn("Plan", "Planning failed, falling back to direct execution.");
    }

    // 2. Execution Phase
    Logger.phase("Execution");

    try {
      await this.memoryManager.summarizeUserMessage(userInput, currentTurnId);
    } catch (e) {
      Logger.warn("Agent", "Failed to summarize user input for short-term memory.");
    }

    // executionHistory 仅用于记录完整对话历史供后续参考/验证，不再直接作为 LLM 上下文
    const executionHistory: ChatCompletionMessageParam[] = [this.systemMessage];

    if (plan && plan.steps && plan.steps.length > 0) {
      executionHistory.push({
        role: "system",
        content: `当前计划:\n${JSON.stringify(plan.steps, null, 2)}\n\n请按顺序执行这些步骤以回答用户请求。`,
      });
    }

    executionHistory.push({ role: "user", content: userInput });

    let finalAnswer = "";
    let turnCount = 0;
    const MAX_TURNS = 15;

    while (turnCount < MAX_TURNS) {
      turnCount++;
      Logger.turn(turnCount, "Thinking...");

      // --- 构建本轮 LLM 上下文 (完全基于动态检索) ---
      // 每一轮都重新构建 Prompt，只包含 System、Plan、检索到的上下文和用户原始输入
      const messagesForTurn: ChatCompletionMessageParam[] = [this.systemMessage];

      // 1. 优先注入计划 (作为基准上下文)
      if (plan && plan.steps && plan.steps.length > 0) {
        messagesForTurn.push({
            role: "system",
            content: `当前计划:\n${JSON.stringify(plan.steps, null, 2)}\n\n请严格遵循上述计划执行。`
        });
      }

      // 2. 动态上下文检索
      try {
        const dynamicContext = await this.memoryManager.retrieveContext(userInput);
        if (dynamicContext) {
          messagesForTurn.push({ 
            role: "system", 
            content: `【当前动态上下文】\n以下是根据你的请求检索到的相关历史信息（包含之前的工具执行结果等）：\n${dynamicContext}\n\n请基于上述上下文继续执行任务。` 
          });
          Logger.info("Context", `Injected dynamic context for turn ${turnCount}`);
        }
      } catch (e) {
        Logger.warn("Context", "Failed to retrieve dynamic context.");
      }

      // 3. 用户输入 (任务锚点)
      messagesForTurn.push({ role: "user", content: userInput });

      const response = await this.llm.chat(messagesForTurn, this.tools, undefined, "Agent");
      
      // Log the immediate response from Assistant
      if (response.content) {
        Logger.llmResponse(response.role, response.content);
        this.memoryManager.summarizeAssistantReply(response.content, turnCount).catch(e => {});
      }

      // 记录到历史数组 (Ref Only)
      executionHistory.push(response);

      // Check if LLM wants to call a tool
      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          
          let args;
          try {
            args = JSON.parse((toolCall as any).function.arguments);
            Logger.toolCall((toolCall as any).function.name, args);
          } catch (e) {
            Logger.error("Tool", `Failed to parse arguments for ${(toolCall as any).function.name}`);
            const errorMsg = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: "Error: Invalid JSON arguments provided."
            };
            executionHistory.push(errorMsg); // Record error
            continue;
          }

          const toolName = (toolCall as any).function.name;

          // Special Logging for execute_code
          if (toolName === 'execute_code' && args.code) {
            Logger.code(args.code);
          }

          // Find correct MCP manager for this tool
          const mcp = this.toolMap.get(toolName);
          if (!mcp) {
             Logger.error("Tool", `${toolName} not found in any MCP server.`);
             const errorMsg = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: `Error: Tool ${toolName} not found.`
            };
            executionHistory.push(errorMsg);
            continue;
          }

          try {
            let contentText = "";
            
            // Intercept search_memories to use Memoryer for deep retrieval
            if (toolName === 'search_memories') {
               const rawResult = await mcp.callTool(toolName, args);
               const rawSummaries = (rawResult as any).content.map((c: any) => c.type === 'text' ? c.text : '').join("\n");
               try {
                 let summaries: any[] = [];
                 try {
                    summaries = JSON.parse(rawSummaries);
                    if (!Array.isArray(summaries)) summaries = [];
                    // Mark as long_term
                    summaries = summaries.map(s => ({ ...s, source: 'long_term' }));
                 } catch (e) {
                    Logger.warn("Agent", "search_memories returned non-JSON");
                 }
                 
                 // Call Memoryer to refine and fetch details
                 const readMemoryMcp = this.toolMap.get('read_memory');
                 if (readMemoryMcp) {
                   contentText = await this.memoryer.retrieve(args.query || "", summaries, readMemoryMcp, this.memoryManager);
                 } else {
                   contentText = rawSummaries; // Fallback if read_memory not found
                 }
               } catch (e) {
                 contentText = rawSummaries;
               }

            } else if (toolName === 'read_skill') {
               Logger.info("Skill", `正在加载技能指令: ${args.name}`);
               const toolResult = await mcp.callTool(toolName, args);
               contentText = (toolResult as any).content.map((c: any) => c.type === 'text' ? c.text : '').join("\n");
            } else {
               const toolResult = await mcp.callTool(toolName, args);
               contentText = (toolResult as any).content.map((c: any) => c.type === 'text' ? c.text : '').join("\n");
            }
            
            Logger.toolOutput(contentText);

            // 重要：工具输出必须被摘要进入 MemoryManager，这样下一轮 retrieveContext 才能检索到它
            this.memoryManager.summarizeToolOutput(toolName, args, contentText, turnCount, toolCall.id)
                .catch(e => Logger.warn("Memory", `Failed to summarize tool output: ${e}`));

            // 记录到历史 (Ref Only)
            executionHistory.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: contentText || "(Tool executed successfully with no text output)"
            });
          } catch (error: any) {
            Logger.error("Tool", `Execution failed: ${error.message}`);
            executionHistory.push({
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
