# Nora Agent — 基于摘要检索的动态短期记忆系统设计

## 1. 设计背景与核心理念

### 现状痛点
目前的短期记忆管理主要依赖“滑动窗口 + 全局摘要（Summary）”。
- **细节丢失**：全局摘要往往会忽略代码片段、具体参数、错误日志等关键细节。
- **上下文效率低**：滑动窗口会将无关的近期对话也包含在内，浪费 Token。
- **工具结果浪费**：Agent Tool 的返回结果（如文件内容、执行日志）通常很长，容易被截断或遗忘。

### 新方案核心：摘要驱动的动态上下文 (Summary-Driven Dynamic Context)
不再依赖单一的线性历史记录。
**核心逻辑**：
1. **全量存储**：每一轮的 User Input、Assistant Reply、Tool Output 都被完整记录，不删减。
2. **实时摘要**：对每一条记录（特别是 Tool Output）实时生成“一句话摘要”。
3. **按需召回**：**每一轮对话**，都根据当前用户意图，去匹配历史摘要。
4. **还原细节**：一旦摘要匹配成功，**取出对应的原始完整内容（Original Content）** 放入当前上下文。

> **"像人一样记忆"**：人不会记得每句话的逐字稿，但记得“刚才查过 A 文件”这个摘要。当需要细节时，人会去“回想”（检索）A 文件的具体内容。

## 2. 数据模型设计

我们需要一个轻量级的内存数据库（或 JSON 文件）来存储“记忆单元”。

### 2.1 记忆单元 (MemoryUnit)

```typescript
interface MemoryUnit {
  id: string;
  turnId: number;           // 对话轮次
  role: 'user' | 'assistant' | 'tool';
  
  // 核心字段
  summary: string;          // AI 生成的简短概述 (用于检索匹配)
  content: string;          // 原始完整内容 (用于构建 Context)
  
  // 元数据
  toolName?: string;        // 如果是 tool，记录工具名
  toolArgs?: any;           // 工具参数
  timestamp: number;
  
  // 关联
  relatedId?: string;       // 例如 tool output 关联 tool call 的 id
}
```

### 2.2 记忆流 (MemoryStream)

一个线性的 `MemoryUnit` 列表，按时间顺序排列。

## 3. 详细交互流程 (The Loop)

### 3.1 阶段一：用户输入处理与上下文构建 (Pre-Run)

当用户发送一条新消息 `UserMsg` 时：

1. **生成摘要**：立即对 `UserMsg` 生成摘要 `UserSummary`。
2. **检索匹配 (The Matching)**：
   - 使用 `UserMsg` + `UserSummary` 作为 Query。
   - 在 `MemoryStream` 中检索最相关的 Top-K 个 `MemoryUnit`（基于 Summary 匹配）。
   - **匹配策略**：可以使用 LLM 评分，也可以使用 Embedding（如果是本地模型）。鉴于 Nora 现状，建议使用 **LLM 快速筛选**。
3. **构建动态上下文 (Prompt Construction)**：
   - **System Prompt**: 保持不变。
   - **Recall Context (关键变化)**: 
     - 插入检索命中的 `MemoryUnit.content` (完整内容)。
     - 标注来源：`[Context from Turn #5: Executed 'read_file']`。
   - **Recent Buffer**: 保留最近 2-3 轮的完整对话（保证对话连贯性）。
   - **Current Input**: `UserMsg`。

### 3.2 阶段二：Agent 执行与记忆写入 (Post-Run)

当 Agent 执行工具或回复时：

1. **工具调用 (Tool Call)**：
   - 执行工具，获取 `ToolOutput` (Raw String)。
2. **生成工具摘要 (Tool Summarization)**：
   - 调用 LLM (轻量级) 生成摘要。
   - 输入：`Tool Name`, `Args`, `ToolOutput`。
   - 输出：`Summary` (例如："读取了 server.py，包含 MCPServer 类的定义")。
3. **存储记忆**：
   - 创建 `MemoryUnit`：
     - `summary`: 生成的摘要。
     - `content`: `ToolOutput` (完整内容)。
   - 存入 `MemoryStream`。
4. **助手回复 (Assistant Reply)**：
   - 生成回复后，同样生成摘要并存入。

## 4. 关键实现逻辑

### 4.1 LLM 摘要器 (Summarizer)
需要一个专门的 Prompt 用于生成摘要，要求：**极简、包含关键实体**。

> **Input**: 
> Tool: `read_file`
> Path: `src/index.ts`
> Content: `import ... (200 lines of code)`
>
> **Output**: 
> "读取了 src/index.ts 的完整代码，包含 MCPManager 初始化和主启动逻辑。"

### 4.2 LLM 匹配器 (Matcher)
在每轮对话开始时调用。

> **Prompt**:
> "用户当前问题是：'{UserInput}'。
> 以下是历史对话片段的摘要列表：
> 1. [Turn 1 User] 让我检查 python 环境
> 2. [Turn 1 Tool] 执行 python --version 返回 3.9.0
> 3. [Turn 2 Tool] 读取 requirements.txt，包含 numpy, pandas
> ...
> 请判断哪些摘要包含回答当前问题所必须的细节？返回 ID 列表。"

## 5. 预期效果

**场景示例**：
1. **Turn 1**: 用户让 Agent 读取 `long_code.py`。
   - Agent 读取，返回 500 行代码。
   - **Memory**: 存入 `content`=500行代码, `summary`="读取 long_code.py，包含数据处理逻辑"。
2. **Turn 2**: 用户闲聊 "天气不错"。
   - **Context**: 不包含 Turn 1 的代码，只包含近期闲聊。节省 Token。
3. **Turn 5**: 用户问 "之前代码里处理日期的函数叫什么？"。
   - **Matcher**: 发现 Turn 1 的摘要 "包含数据处理逻辑" 与 "处理日期函数" 相关。
   - **Context Construction**: 从 Turn 1 取出 **500行完整代码** 放入 Context。
   - **Agent**: 能够准确回答函数名，因为完整代码就在 Context 里。

## 6. 实施路线图

1.  **Refactor MemoryManager**: 废弃旧的 Summarizer，建立 `MemoryStream` 结构。
2.  **Implement Summarizer**: 实现对 ToolOutput 和 UserMessage 的实时摘要。
3.  **Implement Retriever**: 实现基于 LLM 的摘要匹配逻辑。
4.  **Update Agent Loop**: 修改 `agent.ts` 的主循环，嵌入“检索-构建上下文”流程。
