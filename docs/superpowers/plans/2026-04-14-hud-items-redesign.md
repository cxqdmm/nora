# 道具 HUD + 青蛙交互改版实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 把弹框选择改为左侧常驻道具 HUD，青蛙触发直接偷偷溜扣能量，不需要弹框交互。

**Architecture:** UIModule 负责渲染道具 HUD（固定左侧，透明背景）。GameScene 在 NPC 触发时直接扣能量，无弹框。ObstaclePanel.js 删除。FrogNPC 增强激活动画。

---

## 文件变更概览

| 操作 | 文件 |
|------|------|
| 删除 | `src/ui/ObstaclePanel.js` |
| 修改 | `src/scenes/GameScene.js` — 移除弹框，NPC 触发直接偷偷溜 |
| 修改 | `src/modules/UIModule.js` — 新增道具 HUD 渲染 |
| 修改 | `src/modules/CaterpillarModule.js` — 已有 `getHeadPosition()`（无需改）|
| 修改 | `src/modules/ItemModule.js` — 已有（无需改）|
| 修改 | `src/npcs/FrogNPC.js` — 激活时播放扑出动画 |
| 修改 | `src/npcs/NPCModule.js` — 已有（无需改）|

---

## Task 1: UIModule — 道具 HUD

**文件:** 修改 `src/modules/UIModule.js`

### 1.1 构造函数追加属性

在构造函数中，在现有属性之后添加：

```javascript
    /** 道具 HUD 相关 */
    this._itemGfx = null;   // 道具栏背景
    this._itemIcons = [];   // 道具图标数组 [{ type, count, gfx }]
    this._itemContainer = null;
```

### 1.2 新增 `_createItemHUD()` 方法

在 `create()` 方法末尾（`_updateBar()` 调用之前）添加：

```javascript
  // ── 道具 HUD（左侧常驻）──────────────────────────────────
  _createItemHUD() {
    const X = 18;
    const Y = 72;  // 紧贴能量条下方
    const CELL = 42;
    const GAP  = 6;

    const items = this.scene.add.container(X, Y).setDepth(90);
    this._itemContainer = items;
    this._itemIcons = [];

    // 初始空状态：什么都不渲染（保持干净）
    this.scene.children.bringToTop(items);
  }

  /**
   * 刷新道具 HUD
   * 从外部调用（GameScene 在道具变化时调用）
   */
  refreshItemHUD(itemModule) {
    if (!this._itemContainer) return;
    this._itemContainer.removeAll(true);
    this._itemIcons = [];

    const X = 0;
    const Y = 0;
    const CELL = 42;
    const GAP  = 6;

    const hasKnife  = itemModule.hasItem('knife');
    const hasPotion = itemModule.hasItem('potion');

    if (!hasKnife && !hasPotion) return;  // 无道具，不显示 HUD

    // 半透明背景
    const bg = this.scene.add.graphics().setDepth(89);
    bg.fillStyle(0x000000, 0.4);
    bg.fillRoundedRect(-4, -4, CELL + 8, CELL * (hasKnife && hasPotion ? 2 : 1) + GAP + 8, 10);
    this._itemContainer.add(bg);

    let cy = Y;
    if (hasKnife) {
      const count = itemModule.getCount('knife');
      this._addItemCell(X, cy, '🗡️', count);
      cy += CELL + GAP;
    }
    if (hasPotion) {
      const count = itemModule.getCount('potion');
      this._addItemCell(X, cy, '💤', count);
    }
  }

  _addItemCell(x, y, emoji, count) {
    const CELL = 42;
    const gfx = this.scene.add.graphics().setDepth(90);
    // 道具格背景
    gfx.fillStyle(0x2d1a00, 0.85);
    gfx.fillRoundedRect(x, y, CELL, CELL, 8);
    gfx.lineStyle(1.5, 0x6dcf5a, 0.6);
    gfx.strokeRoundedRect(x, y, CELL, CELL, 8);

    // 道具图标（emoji 文本）
    const icon = this.scene.add.text(x + CELL / 2, y + CELL / 2, emoji, {
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(91);
    this._itemContainer.add([gfx, icon]);
    this._itemIcons.push({ type: emoji === '🗡️' ? 'knife' : 'potion', gfx, icon });

    // 数量角标
    if (count > 1) {
      const badge = this.scene.add.graphics().setDepth(92);
      badge.fillStyle(0xff9800, 1);
      badge.fillCircle(x + CELL, y, 9);
      const badgeText = this.scene.add.text(x + CELL, y, String(count), {
        fontSize: '10px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(93);
      this._itemContainer.add([badge, badgeText]);
    }
  }
```

### 1.3 在 `create()` 中调用初始化

在 `this._updateBar();` 之后添加：

```javascript
    this._createItemHUD();
```

---

## Task 2: GameScene — 移除弹框，改为直接偷偷溜

**文件:** 修改 `src/scenes/GameScene.js`

### 2.1 移除 ObstaclePanel import

删除：
```javascript
import { ObstaclePanel } from '../ui/ObstaclePanel.js';
```

### 2.2 修改 `_onArrived()` 的 NPC 触发逻辑

找到现有的 NPC 触发检测代码块，替换为：

```javascript
    // ── NPC 触发检测 ───────────────────────────────────────
    const blockingNpcs = this._map.getBlockingNpcsAtNode(nodeId);
    if (blockingNpcs.length > 0) {
      const npc = blockingNpcs[0];
      npc.activate();
      // 直接偷偷溜：扣能量，让 NPC 退回 idle 状态
      const sneakCost = CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;
      this._energy.drain(sneakCost);
      this._ui.showMessage(`🤫 偷偷溜过，消耗 ⚡${sneakCost} 能量`, 2000);
      npc.reset();  // 青蛙退回 idle，下次经过还会触发
      // 不 return，流程继续走（拾取食物等）
    }
```

**关键变化：** 不再弹出面板，直接扣能量 + 显示提示，然后继续正常流程（可以拾取食物等）。

### 2.3 删除所有弹框相关方法

从 GameScene 中删除：
- `_showObstaclePanel()`
- `_handleKnife()`
- `_handlePotion()`
- `_handleSneak()`
- `_resumeAfterObstacle()`
- `_playKnifeAnimation()`
- `_obstaclePanel` 相关清理（shutdown 中的 `this._obstaclePanel?.destroy()`）

### 2.4 在 `_onArrived` 食物掉落检测后刷新道具 HUD

在食物掉落检测代码块末尾添加：

```javascript
      // 刷新道具 HUD
      this._ui.refreshItemHUD(this._items);
```

### 2.5 在 `create()` 末尾也调用一次 HUD 初始化

在 `create()` 最后（`this._addBackButton();` 之后）添加：

```javascript
      // 初始化道具 HUD（显示已有道具）
      this._ui.refreshItemHUD(this._items);
```

### 2.6 shutdown() 中移除 obstaclePanel 清理

如果有 `this._obstaclePanel?.destroy();`，删除该行。

---

## Task 3: FrogNPC — 激活动画增强

**文件:** 修改 `src/npcs/FrogNPC.js`

### 3.1 增强 `_render()` 激活动画

在 `_render()` 中，当 `this._state === 'active'` 时，播放一个"扑出"动画（缩放 + 抖动）。使用 Phaser tween：

```javascript
  _render() {
    if (!this._gfx) return;
    this._gfx.clear();
    this._killCountdown();

    const nodeA = this._map?.getNode(this._nodeId ?? this.edgeA);
    const nodeB = this._map?.getNode(this.edgeB);
    if (!nodeA || !nodeB) return;

    const mx = (nodeA.x + nodeB.x) / 2;
    const my = (nodeA.y + nodeB.y) / 2;

    if (this._state === 'dead') return;

    if (this._state === 'idle') {
      this._drawFrog(mx, my, 0.6, 0x4caf50);
      this._setGfxPosition(mx, my);
    } else if (this._state === 'active') {
      this._drawFrog(mx, my, 1.0, 0xf44336);
      // 警告圈
      this._gfx.lineStyle(2, 0xff0000, 0.5);
      this._gfx.strokeCircle(mx, my, 22);
      this._setGfxPosition(mx, my);
      // 扑出动画（如果 scene 存在）
      if (this._scene) {
        this._scene.tweens.add({
          targets: this._gfx,
          scaleX: { from: 1.3, to: 1 },
          scaleY: { from: 1.3, to: 1 },
          duration: 200,
          ease: 'Back.easeOut',
        });
        // 抖动
        this._scene.tweens.add({
          targets: this._gfx,
          x: mx + 3,
          duration: 60,
          yoyo: true,
          repeat: 3,
          onComplete: () => { if (this._gfx) this._gfx.x = mx; },
        });
      }
    } else if (this._state === 'sleeping') {
      this._drawFrog(mx, my, 0.8, 0x2196f3);
      this._setGfxPosition(mx, my);
    }
  }
```

### 3.2 添加辅助方法

```javascript
  _setGfxPosition(x, y) {
    this._gfx.setPosition(x, y);
    this._gfx.setScale(1, 1);
    this._gfx.setAlpha(1);
  }
```

### 3.3 `bindGraphics` 时传入 scene

修改 `bindGraphics` 签名以接收 scene：

```javascript
  bindGraphics(gfx, scene) {
    this._gfx = gfx;
    this._scene = scene;
    this._render();
  }
```

### 3.4 更新 MapModule.registerNPC() 调用

在 `src/modules/MapModule.js` 的 `registerNPC()` 中，修改 `npc.bindGraphics(gfx)` 为 `npc.bindGraphics(gfx, this.scene)`。

---

## Task 4: 清理 ObstaclePanel

**文件:** 删除 `src/ui/ObstaclePanel.js`

---

## Task 5: 提交并测试

**文件:** 提交所有变更，浏览器验证

验证清单：
- [ ] 无道具时左侧 HUD 不显示
- [ ] 吃食物掉落道具后，左侧 HUD 刷新显示
- [ ] 到达青蛙节点，自动扣能量并显示提示
- [ ] 青蛙激活时有扑出+抖动动画
- [ ] 睡眠时有倒计时气泡

---

## 依赖顺序

1. Task 4（删除 ObstaclePanel.js）
2. Task 3（FrogNPC 动画 + bindGraphics 签名）
3. Task 1（UIModule 道具 HUD）
4. Task 2（GameScene 整合）
5. Task 5（提交 + 浏览器测试）
