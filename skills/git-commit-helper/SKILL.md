---
name: git-commit-helper
description: 根据暂存区的更改生成符合规范的 Git 提交信息。
version: 1.0.0
---

# Git 提交助手 (Commit Helper)

此技能帮助你生成标准化的 Git 提交信息。

## 使用方法

当用户要求“提交代码”或“生成提交信息”时，请遵循以下步骤：

1.  **检查状态**：运行 `git status` 查看哪些文件已暂存。
2.  **检查差异**：运行 `git diff --cached` 查看实际更改内容。
3.  **分析**：理解更改的意图（新功能、修复、重构等）。
4.  **生成信息**：创建遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范的提交信息：
    `<type>(<scope>): <subject>`
    
    类型 (Types):
    - `feat`: 新功能
    - `fix`: Bug 修复
    - `docs`: 仅文档更改
    - `style`: 不影响代码含义的更改（空格、格式化等）
    - `refactor`: 既不是修复 Bug 也不是添加功能的代码更改
    - `perf`: 提高性能的代码更改
    - `test`: 添加缺失的测试或更正现有的测试
    - `chore`: 对构建过程或辅助工具和库的更改

5.  **执行（可选）**：如果用户明确要求*执行*提交，运行 `git commit -m "your message"`。如果他们只是索要信息，请将其输出在代码块中。

## 示例

- `feat(auth): 添加登录页面组件`
- `fix(api): 处理用户端点的空响应`
