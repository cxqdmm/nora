# NPC 能量消耗徽章 — 设计规格

## 目标

在每只青蛙的右上角持续显示一个红色徽章，标注偷偷溜过所需的能量值。玩家在规划路线时即可看到代价，无需等到触发时才揭晓。

## 修改范围

### 1. NPCModule 基类（`src/npcs/NPCModule.js`）

- 构造函数增加可选参数 `sneakEnergyCost`，默认为 `CONFIG.NPC.FROG.SNEAK_ENERGY_COST`
- 提供 `getSneakEnergyCost()` 公开方法

### 2. FrogNPC（`src/npcs/FrogNPC.js`）

- 接收 `opts.sneakEnergyCost` 并存入实例（透传给基类）
- `bindGraphics()` 中创建两个 Phaser 对象（背景圆 + 文字），保存为实例属性 `_costBg` / `_costText`
- `_render()` 中更新徽章坐标到 NPC 右上角（中心点偏移约 +20, -20）
- `destroy()` 中清理 `_costBg` / `_costText`

**徽章视觉规格：**
- 圆形背景：`0xff4444`，alpha 0.9，半径 14px
- 文字：`⚡{数值}`，白色 12px，黑色描边 2px，垂直居中
- 位置：NPC 中心点 + (20, -20)，depth=155

### 3. GameScene（`src/scenes/GameScene.js`）

- `_onArrived` 中使用 `npc.getSneakEnergyCost()` 替代硬编码的 `CONFIG.NPC.FROG.SNEAK_ENERGY_COST`

### 4. 关卡文件（`src/levels/level*.js`）

- NPC 定义中增加可选字段 `sneakEnergyCost: number`
- 不填则使用 CONFIG 默认值（向后兼容）

## 实现顺序

1. `NPCModule.js` — 增加构造参数和 getter
2. `FrogNPC.js` — 创建/销毁徽章 Phaser 对象
3. `GameScene.js` — 改用 `getSneakEnergyCost()`
4. `level1.js` — 填入示例值 `sneakEnergyCost: 20`
