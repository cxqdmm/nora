# NPC 能量消耗徽章 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在每只青蛙右上角显示红色徽章，持续标注偷偷溜过所需的能量值。

**Architecture:** NPCModule 基类增加 `sneakEnergyCost` 参数和 getter；FrogNPC 在 `bindGraphics()` 中创建两个 Phaser 对象（背景圆 + 文字）作为徽章，跟随 NPC 位置在 `_render()` 中更新坐标；GameScene 通过 NPC 实例方法获取消耗值。

**Tech Stack:** Phaser 3（纯 ES 模块，无构建工具）

---

## 修改文件清单

| 文件 | 操作 |
|------|------|
| `src/npcs/NPCModule.js` | 修改 |
| `src/npcs/FrogNPC.js` | 修改 |
| `src/scenes/GameScene.js` | 修改 |
| `src/levels/level1.js` | 修改 |

---

## Task 1: NPCModule 增加 sneakEnergyCost 参数和 getter

**Files:**
- Modify: `src/npcs/NPCModule.js:14-31`

- [ ] **Step 1: 添加构造参数和 getter**

在 `constructor(opts)` 中，`this._state = 'idle'` 之前插入：

```javascript
// 偷偷溜过的能量消耗（可由子类/关卡覆盖）
this._sneakEnergyCost = opts.sneakEnergyCost ?? CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;
```

在 `_state = 'idle'` 下方添加：

```javascript
this._sleepDuration = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;
```

在文件末尾 `destroy()` 方法前添加 getter：

```javascript
// ── 能量消耗查询 ─────────────────────────────────────────
getSneakEnergyCost() {
  return this._sneakEnergyCost;
}
```

- [ ] **Step 2: 验证文件语法正确**

确认修改后 NPCModule.js 可以正常解析，无语法错误。

- [ ] **Step 3: 提交**

```bash
git add src/npcs/NPCModule.js
git commit -m "feat(NPCModule): add sneakEnergyCost param and getter

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: FrogNPC 创建和销毁徽章 Phaser 对象

**Files:**
- Modify: `src/npcs/FrogNPC.js:8-16`
- Modify: `src/npcs/FrogNPC.js:89-94`（bindGraphics 区域）
- Modify: `src/npcs/FrogNPC.js:106-109`（_render 中更新坐标）
- Modify: `src/npcs/FrogNPC.js:125-127`（destroy 清理）

- [ ] **Step 1: 构造器透传 sneakEnergyCost**

在 `constructor(opts)` 中，在 `super(opts)` 之后、`this._sleepDuration` 之前插入：

```javascript
// 透传给基类（基类已从 opts 读取，无需再次赋值）
```

确认 `super(opts)` 已经将 `opts.sneakEnergyCost` 传给基类 NPCModule，基类会用正确的默认值处理。

- [ ] **Step 2: 在 bindGraphics 中创建徽章 Phaser 对象**

找到 `bindGraphics(gfx, scene)` 方法中，在 `this._scene = scene` 之后、`this._render()` 之前添加：

```javascript
// 能量消耗徽章（背景圆 + 文字）
this._costBg = this._scene.add.graphics().setDepth(155);
this._costText = this._scene.add.text(0, 0, '', {
  fontSize: '12px',
  fontFamily: 'Microsoft YaHei, sans-serif',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 2,
}).setOrigin(0.5).setDepth(156);
this._renderCostBadge();
```

- [ ] **Step 3: 在 _render 末尾调用 _renderCostBadge 更新坐标**

在 `_render()` 方法最后（`return` 之后、`renderBody()` 定义之前）添加：

```javascript
// 更新徽章位置（跟随 NPC）
_renderCostBadge() {
  if (!this._costBg || !this._costText) return;
  const cost = this.getSneakEnergyCost();
  const badgeX = this._mx + 20;
  const badgeY = this._my - 20;
  const radius = 14;

  this._costBg.clear();
  this._costBg.fillStyle(0xff4444, 0.9);
  this._costBg.fillCircle(badgeX, badgeY, radius);

  this._costText.setPosition(badgeX, badgeY);
  this._costText.setText(`⚡${cost}`);
}
```

- [ ] **Step 4: 在 _render() 中调用 _renderCostBadge**

在 `_render()` 方法最后（`_killEffects()` 调用之后、`if (this._state === 'dead') return` 之后）添加：

```javascript
this._renderCostBadge();
```

- [ ] **Step 5: destroy() 中清理徽章对象**

在 `destroy()` 方法中，`this._killCountdown()` 之后添加：

```javascript
this._costBg?.destroy();
this._costText?.destroy();
```

- [ ] **Step 6: 提交**

```bash
git add src/npcs/FrogNPC.js
git commit -m "feat(FrogNPC): add always-visible energy cost badge

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: GameScene 使用 getSneakEnergyCost() 替代硬编码常量

**Files:**
- Modify: `src/scenes/GameScene.js:152`

- [ ] **Step 1: 找到硬编码位置并替换**

在 `_onArrived` 方法中，找到这行：

```javascript
const sneakCost = CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;
```

替换为：

```javascript
const sneakCost = npc.getSneakEnergyCost();
```

- [ ] **Step 2: 提交**

```bash
git add src/scenes/GameScene.js
git commit -m "refactor(GameScene): use npc.getSneakEnergyCost() instead of hardcoded constant

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: level1.js 填入 sneakEnergyCost 示例值

**Files:**
- Modify: `src/levels/level1.js:67-74`

- [ ] **Step 1: 在 NPC 定义中增加 sneakEnergyCost 字段**

在 `npcs` 数组的青蛙定义中，增加字段：

```javascript
npcs: [
  {
    id: 'frog_1',
    type: 'frog',
    edgeA: 3,
    edgeB: 5,
    sneakEnergyCost: 20,
  },
],
```

- [ ] **Step 2: 提交**

```bash
git add src/levels/level1.js
git commit -m "feat(level1): add sneakEnergyCost: 20 to frog_1

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 自检清单

- [ ] NPCModule.js 中 `this._sneakEnergyCost` 在 `this._state` 之前初始化 ✓
- [ ] NPCModule.js 中 `getSneakEnergyCost()` 方法已添加 ✓
- [ ] FrogNPC.js 中 `_costBg` 和 `_costText` 在 `bindGraphics` 中创建 ✓
- [ ] FrogNPC.js 中 `_renderCostBadge()` 在 `_render()` 中被调用 ✓
- [ ] FrogNPC.js 中 `destroy()` 清理了 `_costBg` 和 `_costText` ✓
- [ ] GameScene.js 中 `npc.getSneakEnergyCost()` 替代了硬编码常量 ✓
- [ ] level1.js 中 `sneakEnergyCost: 20` 已填入 ✓
- [ ] 无 "TBD"、"TODO"、占位符代码 ✓
