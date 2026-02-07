import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMService } from './llm-service.js';
import { MCPManager } from './mcp-manager.js';
import { Planner, Plan } from './planner.js';
import { Logger } from './logger.js';
import { Memoryer } from './memoryer.js';
import { MemoryManager } from './context-manager.js';
import { ScratchpadManager } from './scratchpad.js';
import { TaskManager } from './task-manager.js';
import { RunningSummaryManager } from './running-summary.js';

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
  private scratchpadManager: ScratchpadManager;
  private taskManager: TaskManager;
  private runningSummaryManager: RunningSummaryManager;
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
    this.scratchpadManager = new ScratchpadManager();
    this.taskManager = new TaskManager();
    this.runningSummaryManager = new RunningSummaryManager();

    this.systemMessage = {
      role: "system",
      content: SYSTEM_PROMPT,
    };
  }

  async initialize() {
    this.tools = [];
    this.toolMap.clear();
    // this.scratchpadManager.clear(); // Removed: State persists across sessions if managed externally, or resets per task
    // We don't want to clear global state here as it might be a resumed session in future.
    // For now, in-memory is volatile so it clears on restart anyway.

    // 0. Add Built-in Tools
    this.tools.push(this.scratchpadManager.getToolDefinition());
    this.tools.push(this.runningSummaryManager.getToolDefinition());
    
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
        Logger.error("Agent", `从 MCP 服务器获取工具列表失败: ${e}`);
      }
    }
    Logger.info("Agent", `初始化工具: ${this.tools.map(t => (t as any).function.name).join(', ')}`);

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
          Logger.info("Agent", `已注入 ${skillsList.length} 个技能到系统提示词。`);
        }
      }
    } catch (e) {
      Logger.warn("Agent", `注入技能元数据失败: ${e}`);
    }
  }


  /**
   * Phase 1: Planning
   * Creates a plan based on user input and available tools.
   */
  private async runPlanningPhase(userInput: string, currentTaskId: string): Promise<Plan | null> {
    Logger.phase("规划阶段");
    
    // List available tools for debugging/visibility
    const availableToolNames = this.tools.map(t => (t as any).function.name);
    Logger.info("工具", `可用工具: ${availableToolNames.join(', ')}`);

    let plan: Plan | null = null;
    try {
      const planningHistory: ChatCompletionMessageParam[] = [this.systemMessage];

      const dynamicContextForPlan = await this.memoryManager.retrieveContext(userInput, currentTaskId);
      if (dynamicContextForPlan) {
        planningHistory.push({ role: "assistant", content: `【短期记忆召回】\n${dynamicContextForPlan}` });
      }
      
      plan = await this.planner.createPlan(userInput, planningHistory, this.tools);
      
      if (plan.steps && plan.steps.length > 0) {
        Logger.plan(plan.reasoning);
        plan.steps.forEach(step => Logger.step(step.id, step.description));
      } else {
        Logger.plan(`无需复杂计划: ${plan.reasoning}`);
      }
      
    } catch (e) {
      Logger.warn("Plan", "规划失败，回退到直接执行。");
    }
    return plan;
  }

  /**
   * Builds the context messages for the current turn.
   */
  private async buildContextForTurn(
    userInput: string,
    currentTaskId: string,
    currentTask: any,
    plan: Plan | null,
    focusQuery: string,
    lastTurnMessages: ChatCompletionMessageParam[]
  ): Promise<ChatCompletionMessageParam[]> {
    const messagesForTurn: ChatCompletionMessageParam[] = [this.systemMessage];

    // 1. 优先注入计划 (作为基准上下文)
    if (plan && plan.steps && plan.steps.length > 0) {
      // 获取最新的 Scratchpad 内容
      const scratchpadContent = this.scratchpadManager.getFormattedContent(currentTaskId);
      // 获取最新的 Running Summary
      const runningSummaryContent = this.runningSummaryManager.getFormattedContent(currentTaskId);
      
      messagesForTurn.push({
          role: "system",
          content: `【执行进度面板】
当前任务: ${currentTask?.title} (ID: ${currentTaskId})

当前计划:
${JSON.stringify(plan.steps, null, 2)}

${runningSummaryContent}

${scratchpadContent}

指令：
1. 请根据下方提供的【记忆回溯资料】、【全局任务白板】和【任务进度摘要】，严格核对上述计划的完成情况。
2. 明确你当前正处于哪一步骤，不要重复执行已完成的步骤。
3. 如果本步骤产生了跨步骤需要的关键信息（如ID、路径、结果），请务必调用 'manage_scratchpad' 记录到白板中。
4. 每当完成一个重要步骤，请务必调用 'update_running_summary' 更新进度摘要。`
      });
      
      Logger.info("Context", `注入全局上下文: 计划, 白板 (${scratchpadContent.length} 字符), 进度摘要 (${runningSummaryContent.length} 字符)`);
    }

    // 2. 动态上下文检索 (修复 #1: 使用 focusQuery 而非静态 userInput)
    try {
      const dynamicContext = await this.memoryManager.retrieveContext(focusQuery, currentTaskId);
      if (dynamicContext) {
        // 修复 #4 (修正): 将 Context 作为 user 消息注入，而非 system 消息
        // 这样模型会将其视为"用户提供的背景资料"，权重更符合预期，且不会混淆系统指令
        messagesForTurn.push({ 
          role: "user", 
          content: `【记忆回溯资料】\n以下是相关的历史信息（之前的工具输出等），供参考：\n${dynamicContext}` 
        });
        Logger.info("Context", `注入动态上下文 (Query: "${focusQuery.substring(0, 50)}...")`);
      }
    } catch (e) {
      Logger.warn("Context", "无法检索动态上下文。");
    }

    // 3. 用户输入 (始终作为任务锚点)
    // 在 Context 之后，作为明确的指令
    messagesForTurn.push({ role: "user", content: `【当前指令】\n${userInput}` });

    // 4. 注入上一轮的交互 (修复 #3: 确保连贯性)
    // 这能让 LLM 清晰地看到"我刚刚做了什么"，比检索更可靠
    if (lastTurnMessages.length > 0) {
       messagesForTurn.push(...lastTurnMessages);
    }

    return messagesForTurn;
  }

  /**
   * Executes tools requested by the LLM.
   * Handles both built-in tools (Scratchpad, RunningSummary) and MCP tools.
   */
  private async executeTools(
    toolCalls: any[], 
    currentTaskId: string,
    userInput: string,
    turnCount: number,
    currentTurnId: number,
    executionHistory: ChatCompletionMessageParam[],
    lastTurnMessages: ChatCompletionMessageParam[]
  ): Promise<string[]> {
    const toolSummaries: string[] = [];

    for (const toolCall of toolCalls) {
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
        Logger.toolCall(toolCall.function.name, args);
      } catch (e) {
        Logger.error("Tool", `解析参数失败 ${toolCall.function.name}`);
        const errorMsg = {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: "错误：提供的 JSON 参数无效。"
        };
        executionHistory.push(errorMsg);
        lastTurnMessages.push(errorMsg);
        continue;
      }

      const toolName = toolCall.function.name;

      // Special Logging for execute_code
      if (toolName === 'execute_code' && args.code) {
        Logger.code(args.code);
      }

      // --- Built-in Tools Handling ---
      
      // 1. Manage Scratchpad
      if (toolName === 'manage_scratchpad') {
        try {
          const output = this.scratchpadManager.handleToolCall(currentTaskId, args);
          Logger.toolOutput(output);
          
          const toolMsg = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: output
          };
          executionHistory.push(toolMsg);
          lastTurnMessages.push(toolMsg);
          
          // Summarize to memory
          this.memoryManager.summarizeToolOutput(toolName, args, output, currentTurnId, currentTaskId, toolCall.id)
              .catch(e => Logger.warn("Memory", `工具输出摘要失败: ${e}`));
          
          toolSummaries.push(`Tool ${toolName} output: ${output}`);
          continue; 
        } catch (e: any) {
           const errorMsg = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: `更新白板时出错: ${e.message}`
           };
           executionHistory.push(errorMsg);
           lastTurnMessages.push(errorMsg);
           continue;
        }
      }

      // 2. Update Running Summary
      if (toolName === 'update_running_summary') {
        try {
          const output = this.runningSummaryManager.handleToolCall(currentTaskId, args);
          Logger.toolOutput(output);
          
          const toolMsg = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: output
          };
          executionHistory.push(toolMsg);
          lastTurnMessages.push(toolMsg);

          // Summarize to memory
          this.memoryManager.summarizeToolOutput(toolName, args, output, currentTurnId, currentTaskId, toolCall.id)
              .catch(e => Logger.warn("Memory", `工具输出摘要失败: ${e}`));
          
          toolSummaries.push(`Tool ${toolName} output: ${output}`);
          continue;
        } catch (e: any) {
           const errorMsg = {
              role: "tool" as const,
              tool_call_id: toolCall.id,
              content: `更新进度摘要时出错: ${e.message}`
           };
           executionHistory.push(errorMsg);
           lastTurnMessages.push(errorMsg);
           continue;
        }
      }

      // --- MCP Tools Handling ---
      
      const mcp = this.toolMap.get(toolName);
      if (!mcp) {
         Logger.error("Tool", `${toolName} 在任何 MCP 服务器中均未找到。`);
         const errorMsg = {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: `错误：未找到工具 ${toolName}。`
        };
        executionHistory.push(errorMsg);
        lastTurnMessages.push(errorMsg);
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
                Logger.warn("Agent", "search_memories 返回了非 JSON 格式数据");
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

        // Summarize to MemoryManager
        const memoryUnit = await this.memoryManager.summarizeToolOutput(toolName, args, contentText, currentTurnId, currentTaskId, toolCall.id)
            .catch(e => {
                Logger.warn("Memory", `工具输出摘要失败: ${e}`);
                return null;
            });
        
        if (memoryUnit) {
            toolSummaries.push(`Tool ${toolName} output: ${memoryUnit.summary}`);
        }

        // Record to History
        const toolMsg = {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: contentText || "(工具执行成功，无文本输出)"
        };
        executionHistory.push(toolMsg);
        lastTurnMessages.push(toolMsg);

      } catch (error: any) {
        Logger.error("Tool", `执行失败: ${error.message}`);
        const errorMsg = {
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: `执行工具出错: ${error.message}`
        };
        executionHistory.push(errorMsg);
        lastTurnMessages.push(errorMsg);
      }
    }

    return toolSummaries;
  }

  async chat(userInput: string): Promise<string> {
    this.turnId += 1;
    const currentTurnId = this.turnId;
    
    // Ensure we have a task ID
    const currentTaskId = this.taskManager.getCurrentTaskId();
    const currentTask = this.taskManager.getCurrentTask();

    // 1. Plan Phase
    const plan = await this.runPlanningPhase(userInput, currentTaskId);

    // Update Task Title if provided by Planner
    if (plan && plan.taskTitle) {
       this.taskManager.updateTaskTitle(currentTaskId, plan.taskTitle);
       Logger.info("任务", `更新任务标题为: "${plan.taskTitle}"`);
    }

    // 2. Execution Phase
    Logger.phase("执行阶段");

    try {
      await this.memoryManager.summarizeUserMessage(userInput, currentTurnId, currentTaskId);
    } catch (e) {
      Logger.warn("Agent", "用户输入短期记忆摘要失败。");
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

    // 修复 #3: 保留上一轮的完整交互作为"即时上下文"，防止思维链断裂
    let lastTurnMessages: ChatCompletionMessageParam[] = [];
    // 修复 #1: 动态关注点 Query，初始为用户输入，后续会追加工具执行的关键信息
    let focusQuery = userInput;

    while (turnCount < MAX_TURNS) {
      turnCount++;
      Logger.turn(turnCount, "思考中...");

      // --- 构建本轮 LLM 上下文 ---
      const messagesForTurn = await this.buildContextForTurn(
        userInput, 
        currentTaskId, 
        currentTask, 
        plan, 
        focusQuery, 
        lastTurnMessages
      );

      const response = await this.llm.chat(messagesForTurn, this.tools, undefined, "Agent");
      
      // 清空上一轮缓存，准备记录本轮
      lastTurnMessages = []; 

      // Log the immediate response from Assistant
      if (response.content) {
        Logger.llmResponse(response.role, response.content);
        // Fix: Use currentTurnId (global) instead of turnCount (local) for consistency
        await this.memoryManager.summarizeAssistantReply(response.content, currentTurnId, currentTaskId).catch(e => {});
      }

      // 记录到历史数组 (Ref Only)
      executionHistory.push(response);
      // 记录到即时上下文缓存
      lastTurnMessages.push(response);

      // Check if LLM wants to call a tool
      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolSummaries = await this.executeTools(
            response.tool_calls,
            currentTaskId,
            userInput,
            turnCount,
            currentTurnId, // Pass global turn ID
            executionHistory,
            lastTurnMessages
        );

        // 修复 #1: 更新 focusQuery
        if (toolSummaries.length > 0) {
            focusQuery = `${userInput}\n[Recent Context]: ${toolSummaries.join('; ')}`;
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
