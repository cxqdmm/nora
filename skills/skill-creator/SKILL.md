---
name: skill-creator
description: 帮助用户为 Nora Agent 创建新技能。
version: 1.0.0
---

# 技能创建器 (Skill Creator)

此技能帮助你通过生成适当的目录结构和 `SKILL.md` 文件，为 Nora Agent 创建新技能。

## 使用方法

当用户想要“创建技能”、“添加新能力”或“教你如何做 X”时，请遵循以下步骤：

1.  **理解目标**：询问用户该技能应该做什么，需要什么输入，以及预期的输出是什么。
2.  **确定名称**：为技能选择一个 kebab-case 名称（例如 `git-commit-helper`, `jira-updater`）。
3.  **起草内容**：创建 `SKILL.md` 的内容，包括：
    -   YAML Frontmatter (`name`, `description`, `version`)
    -   技能描述
    -   给 Agent 的分步指令
    -   示例
4.  **创建文件**：
    -   创建目录：`skills/<skill-name>/`
    -   写入文件：`skills/<skill-name>/SKILL.md`
    -   （可选）如果需要，创建 `scripts/` 或 `references/`。

## 模板

```markdown
---
name: <skill-name>
description: <简短描述>
version: 1.0.0
---

# <技能标题>

<关于此技能功能的详细描述>

## 使用方法

1. 步骤 1
2. 步骤 2
...

## 示例

- 示例 1
```

## 编写技能的技巧
- 指令要具体。
- 使用清晰的标题。
- 如果技能涉及复杂逻辑，建议在 `scripts/` 文件夹中编写脚本（Python 或 Node.js）并调用它。
