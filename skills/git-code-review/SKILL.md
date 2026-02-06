---
name: git-code-review
description: 分析暂存区或已提交的更改，并提供代码审查（Code Review）。
version: 2.0.0
---

# Git 代码审查 (Code Review) 技能

此技能帮助你审查 Git 仓库中的代码变更。它可以分析暂存区的更改或特定的提交，并针对代码质量、潜在 Bug、安全问题和代码风格提供反馈。

**重要原则：为了避免上下文溢出，必须采用“逐个文件审查”的策略。**

## 使用方法

当用户要求“审查代码”、“检查我的修改”或“CR”时，请严格遵循以下步骤：

1.  **确定范围**：判断用户想要审查的内容：
    -   暂存区的更改（默认）：`--cached`
    -   工作区的更改：(无参数)
    -   特定提交：`<commit-hash>`
    -   分支对比：`<target_branch>...<source_branch>` (例如 `master...develop`)

2.  **获取文件列表**：
    -   首先，**只获取变更的文件名列表**，不要直接获取所有 diff 内容。
    -   命令示例：
        -   暂存区：`git diff --cached --name-only`
        -   分支对比：`git diff master...develop --name-only`
    -   排除无关文件（如 `package-lock.json`, `yarn.lock`, `dist/` 等）。

3.  **逐个文件审查 (Iterative Review)**：
    -   对于列表中的每一个文件，**单独**执行 diff 命令获取该文件的具体变更。
    -   命令示例：`git diff --cached -- <file_path>` 或 `git diff master...develop -- <file_path>`
    -   **立即分析**该文件的代码变更，重点关注：
        -   **正确性**：逻辑错误、潜在 Bug。
        -   **安全性**：漏洞、密钥泄露。
        -   **规范性**：命名、注释、结构。
    -   **输出中间结果**：每审查完一个文件，立即输出该文件的简要 Review 意见（作为思考过程或中间回复）。

4.  **最终汇总报告**：
    -   在所有文件审查完毕后，输出一份**总结报告**。
    -   **整体评价**：代码质量打分或总体印象。
    -   **高危问题汇总**：列出所有文件中发现的严重问题（Blocker/Critical）。
    -   **主要建议**：通用的改进建议。

## 示例

**用户：** “Review 一下当前分支和 master 的差异。”

**Agent 执行流程：**

1.  **获取列表**：
    执行 `git diff master...HEAD --name-only`
    *输出：*
    ```
    src/auth.ts
    src/utils.ts
    README.md
    ```

2.  **循环审查**：
    -   **文件 1**: `src/auth.ts`
        -   执行: `git diff master...HEAD -- src/auth.ts`
        -   分析: 发现登录逻辑缺少 try-catch。
        -   *记录*: "src/auth.ts: 缺少错误处理。"
    
    -   **文件 2**: `src/utils.ts`
        -   执行: `git diff master...HEAD -- src/utils.ts`
        -   分析: 新增了一个工具函数，看起来没问题。
        -   *记录*: "src/utils.ts: 无明显问题。"
    
    -   **文件 3**: `README.md`
        -   (跳过或简单扫一眼)

3.  **最终回复**：
    "我审查了变更的 3 个文件，主要发现如下：
    - **src/auth.ts**: 🚨 登录逻辑缺少异常捕获，建议立即修复。
    - **src/utils.ts**: ✅ 通过。
    
    建议合并前修复 auth.ts 中的问题。"
