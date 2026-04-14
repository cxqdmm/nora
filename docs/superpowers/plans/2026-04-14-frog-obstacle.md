# 青蛙障碍系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在第一关引入青蛙障碍，玩家可用道具或偷偷溜方式通过。道具通过吃食物随机掉落。

**Architecture:** 以 MapModule 为桥梁连接关卡数据和渲染。MapModule 持有 NPC 实例；GameScene 通过 MapModule 感知 NPC 触发；ItemModule 独立于 Phaser 管理背包；ObstaclePanel 覆在 GameScene 之上处理道具选择 UI。所有 NPC 继承自抽象 NPCModule 基类。

**Tech Stack:** Phaser 3.60 ESM，无构建步骤，无测试框架，浏览器验证。

---

## 文件概览

| 操作 | 文件 |
|------|------|
| 新增 | `src/modules/ItemModule.js` |
| 新增 | `src/npcs/NPCModule.js` |
| 新增 | `src/npcs/FrogNPC.js` |
| 新增 | `src/ui/ObstaclePanel.js` |
| 修改 | `src/config.js` |
| 修改 | `src/modules/MapModule.js` |
| 修改 | `src/modules/GameScene.js` |
| 修改 | `src/levels/level1.js` |

---

## Task 1: 配置项 — `config.js`

**文件:** 修改 `src/config.js`

- [ ] **Step 1: 在 `CONFIG` 中追加 NPC 和道具配置**

在 `CONFIG` 对象末尾（`};` 之前）添加：

```javascript
  // ---------- 道具 ----------
  ITEMS: {
    DROP_CHANCE: {
      leaf:  { knife: 0.20, potion: 0    },
      berry: { knife: 0    , potion: 0.20 },
      apple: { knife: 0.15 , potion: 0.15 },
    },
  },

  // ---------- NPC ----------
  NPC: {
    FROG: {
      SLEEP_DURATION_MS: 5000,
      SNEAK_ENERGY_COST: 20,
    },
  },
```

---

## Task 2: 道具模块 — `ItemModule.js`

**文件:** 新建 `src/modules/ItemModule.js`

这是纯逻辑模块，不依赖 Phaser，与 EnergyModule 模式一致。

- [ ] **Step 1: 创建文件，写出基础框架**

```javascript
// ============================================================
//  ItemModule.js — 道具管理，背包无限容量
// ============================================================

export class ItemModule {
  constructor() {
    /** @type {{ knife: number, potion: number }} */
    this._items = { knife: 0, potion: 0 };
  }

  addItem(type) {
    if (type !== 'knife' && type !== 'potion') return;
    this._items[type]++;
  }

  removeItem(type) {
    if (type !== 'knife' && type !== 'potion') return;
    this._items[type] = Math.max(0, this._items[type] - 1);
  }

  hasItem(type) {
    return (this._items[type] ?? 0) > 0;
  }

  getCount(type) {
    return this._items[type] ?? 0;
  }

  /** 随机掉落检查，根据食物类型决定是否掉落 */
  rollDrop(foodType) {
    const cfg = CONFIG.ITEMS.DROP_CHANCE[foodType];
    if (!cfg) return null;
    if (Math.random() < (cfg.knife  ?? 0)) return 'knife';
    if (Math.random() < (cfg.potion ?? 0)) return 'potion';
    return null;
  }
}

import { CONFIG } from './config.js';
```

- [ ] **Step 2: 修正 import 顺序**

把 `import { CONFIG } from './config.js';` 移到文件顶部，放在模块注释之后、class 定义之前。

---

## Task 3: NPC 基类 — `NPCModule.js`

**文件:** 新建 `src/npcs/NPCModule.js`

- [ ] **Step 1: 创建 NPCModule 基类**

```javascript
// ============================================================
//  NPCModule.js — NPC 抽象基类
// ============================================================
import { CONFIG } from '../config.js';

export class NPCModule {
  /**
   * @param {object} opts
   * @param {string} opts.id  唯一标识
   * @param {number} opts.edgeA  所在边端点节点 id
   * @param {number} opts.edgeB  所在边另一端点节点 id
   */
  constructor(opts) {
    this.id    = opts.id;
    this.edgeA = opts.edgeA;
    this.edgeB = opts.edgeB;
    this._state = 'idle';           // 'idle' | 'active' | 'sleeping' | 'dead'
    this._sleepDuration = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;
    this._sleepTimer    = null;
    this._sleepEndTime  = 0;
    /** 玩家通过时的回调 (npc) */
    this.onPass = null;
  }

  // ── 状态查询 ────────────────────────────────────────────
  getState()         { return this._state; }
  isBlocking()        { return this._state === 'active' || this._state === 'idle'; }
  isDead()            { return this._state === 'dead'; }

  // ── 状态转换 ────────────────────────────────────────────
  activate() {
    if (this._state === 'dead' || this._state === 'sleeping') return;
    this._state = 'active';
    this._render();
  }

  /** 睡眠 duration 毫秒后自动醒来 */
  sleep(durationMs) {
    if (this._state === 'dead') return;
    this._clearSleepTimer();
    this._state = 'sleeping';
    this._sleepEndTime = Date.now() + (durationMs ?? this._sleepDuration);
    this._render();
    this._sleepTimer = setTimeout(() => this._wakeUp(), durationMs ?? this._sleepDuration);
  }

  kill() {
    if (this._state === 'dead') return;
    this._clearSleepTimer();
    this._state = 'dead';
    this._render();
  }

  reset() {
    this._clearSleepTimer();
    this._state = 'idle';
    this._render();
  }

  // ── 睡眠内部 ────────────────────────────────────────────
  _wakeUp() {
    if (this._state === 'sleeping') {
      this._state = 'active';
      this._render();
    }
  }

  _clearSleepTimer() {
    if (this._sleepTimer) {
      clearTimeout(this._sleepTimer);
      this._sleepTimer = null;
    }
  }

  /** 获取剩余睡眠秒数，-1 表示未在睡眠 */
  getSleepSecondsLeft() {
    if (this._state !== 'sleeping') return -1;
    return Math.max(0, Math.ceil((this._sleepEndTime - Date.now()) / 1000));
  }

  // ── 子类实现 ────────────────────────────────────────────
  /** 子类覆盖：绑定到 Phaser Graphics 对象进行渲染 */
  bindGraphics(/** @type {Phaser.GameObjects.Graphics} */ gfx) {
    this._gfx = gfx;
    this._render();
  }

  /** 子类覆盖：根据当前状态重绘 */
  _render() {
    // 基类实现为空，子类 FrogNPC 覆盖
  }

  /** 子类覆盖：返回节点 id 数组，标识触发区域 */
  getTriggerNodeIds() {
    return [this.edgeA, this.edgeB];
  }

  destroy() {
    this._clearSleepTimer();
  }
}
```

---

## Task 4: 青蛙实现 — `FrogNPC.js`

**文件:** 新建 `src/npcs/FrogNPC.js`

- [ ] **Step 1: 创建 FrogNPC 类**

```javascript
// ============================================================
//  FrogNPC.js — 青蛙 NPC
// ============================================================
import { NPCModule }    from './NPCModule.js';
import { CONFIG }       from '../config.js';
// 注：quadBezier 定义在下方（纯函数，无外部依赖）

export class FrogNPC extends NPCModule {
  constructor(opts) {
    super(opts);
    this._sleepDuration = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;
    this._countdownGfx   = null;
    this._countdownText  = null;
    this._countdownInterval = null;
  }

  // ── 状态渲染 ────────────────────────────────────────────
  _render() {
    if (!this._gfx) return;
    this._gfx.clear();
    this._killCountdown();

    const nodeA = this._map?.getNode(this.edgeA);
    const nodeB = this._map?.getNode(this.edgeB);
    if (!nodeA || !nodeB) return;

    // 青蛙位置：树枝中点 + 轻微上偏移
    const mx = (nodeA.x + nodeB.x) / 2;
    const my = (nodeA.y + nodeB.y) / 2;

    if (this._state === 'dead') {
      // 青蛙消失，不渲染任何东西
      return;
    }

    if (this._state === 'idle') {
      // 坐姿青蛙（坐在树枝上，略小）
      this._drawFrog(mx, my, 0.6, 'rgba(76,175,80,0.7)');
    } else if (this._state === 'active') {
      // 攻击姿态（扑出，略大，带红色警告）
      this._drawFrog(mx, my, 1.0, 'rgba(244,67,54,0.85)');
      // 附加警告圈
      this._gfx.lineStyle(2, 0xff0000, 0.5);
      this._gfx.strokeCircle(mx, my, 20);
    } else if (this._state === 'sleeping') {
      // 睡着姿态
      this._drawFrog(mx, my, 0.8, 'rgba(33,150,243,0.7)');
      // ZZZ 效果用青色标注
      this._gfx.fillStyle(0x64b5f6, 0.8);
      this._gfx.fillCircle(mx + 12, my - 22, 8);
    }
  }

  _drawFrog(x, y, scale, color) {
    // 简化青蛙：用两个叠圆代表身体
    const r = Math.round(14 * scale);
    this._gfx.fillStyle(0x2e7d32, 1);
    this._gfx.fillCircle(x, y + 4, r);
    this._gfx.fillCircle(x, y - r + 4, Math.round(r * 0.85));
    // 眼睛
    this._gfx.fillStyle(0xffffff, 1);
    this._gfx.fillCircle(x - 4, y - r + 2, 3);
    this._gfx.fillCircle(x + 4, y - r + 2, 3);
    this._gfx.fillStyle(0x000000, 1);
    this._gfx.fillCircle(x - 4, y - r + 3, 1.5);
    this._gfx.fillCircle(x + 4, y - r + 3, 1.5);
  }

  // ── 倒计时气泡 ──────────────────────────────────────────
  _startCountdown(scene) {
    if (!scene) return;
    this._killCountdown();

    const nodeA = this._map?.getNode(this.edgeA);
    const nodeB = this._map?.getNode(this.edgeB);
    if (!nodeA || !nodeB) return;
    const mx = (nodeA.x + nodeB.x) / 2;
    const my = (nodeA.y + nodeB.y) / 2;

    this._countdownGfx  = scene.add.graphics().setDepth(150);
    this._countdownText = scene.add.text(mx, my - 30, '', {
      fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(151);

    this._countdownInterval = setInterval(() => {
      const left = this.getSleepSecondsLeft();
      if (left < 0) { this._killCountdown(); return; }
      if (this._countdownGfx) {
        this._countdownGfx.clear();
        const radius = 10 + left * 2;  // 越大越危险
        const red   = Math.min(255, (5 - left) * 50);
        this._countdownGfx.fillStyle(Phaser.Display.Color.GetColor(red, 50, 50), 0.85);
        this._countdownGfx.fillCircle(mx, my - 30, radius);
      }
      if (this._countdownText) {
        this._countdownText.setText(left > 0 ? String(left) : '!');
      }
    }, 200);
  }

  _killCountdown() {
    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
    this._countdownGfx?.destroy();  this._countdownGfx  = null;
    this._countdownText?.destroy(); this._countdownText = null;
  }

  // ── 睡眠时触发倒计时 ────────────────────────────────────
  sleep(durationMs) {
    // 需要 scene 来显示倒计时气泡，通过外部传入
    // 这里先调用基类，外部用 _startCountdownUI 补充
    super.sleep(durationMs);
  }

  /** 外部调用：开始倒计时气泡（需要 scene） */
  startCountdownUI(scene) {
    this._startCountdown(scene);
  }

  // ── 绑定 MapModule（用于坐标查询）───────────────────────
  bindMap(mapModule) {
    this._map = mapModule;
  }

  getTriggerNodeIds() {
    return [this.edgeA, this.edgeB];
  }

  destroy() {
    this._killCountdown();
    super.destroy();
  }
}
```

- [ ] **Step 2: 验证文件语法**

在 `src/npcs/` 目录创建文件，确认无语法错误。

---

## Task 5: 道具面板 UI — `ObstaclePanel.js`

**文件:** 新建 `src/ui/ObstaclePanel.js`

作为 GameScene 的子组件（不使用独立场景），在 GameScene 激活 NPC 时显示。

- [ ] **Step 1: 创建 ObstaclePanel 类**

```javascript
// ============================================================
//  ObstaclePanel.js — 道具选择面板（GameScene 嵌入式组件）
// ============================================================
import { CONFIG } from '../config.js';

export class ObstaclePanel {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('../modules/ItemModule').ItemModule} itemModule
   * @param {import('../npcs/NPCModule').NPCModule} npc
   * @param {Function} onKnife     — 玩家选择小刀
   * @param {Function} onPotion    — 玩家选择催眠药
   * @param {Function} onSneak     — 玩家选择偷偷溜
   */
  constructor(scene, itemModule, npc, { onKnife, onPotion, onSneak }) {
    this.scene      = scene;
    this.itemModule = itemModule;
    this.npc        = npc;
    this.onKnife    = onKnife;
    this.onPotion   = onPotion;
    this.onSneak    = onSneak;
    this._container = null;
    this._visible  = false;
  }

  show() {
    if (this._visible) return;
    this._visible = true;

    const W = CONFIG.CANVAS_WIDTH;
    const H = CONFIG.CANVAS_HEIGHT;
    const depth = 300;

    // 遮罩
    const overlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setDepth(depth).setInteractive();

    // 面板容器
    const panelW = 320, panelH = 240;
    const panel  = this.scene.add.container(W / 2, H / 2).setDepth(depth + 1);
    const gfx    = this.scene.add.graphics().setDepth(depth + 2);

    // 面板背景
    gfx.fillStyle(0x1b2a1b, 0.95);
    gfx.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    gfx.lineStyle(3, 0x6dcf5a, 1);
    gfx.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);

    // 标题
    const title = this.scene.add.text(0, -panelH / 2 + 24, '🐸 青蛙挡住了去路！', {
      fontSize: '18px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ff6b6b', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(depth + 3);

    // 道具行
    const hasKnife  = this.itemModule.hasItem('knife');
    const hasPotion = this.itemModule.hasItem('potion');
    const sneakCost = CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;

    // 小刀按钮
    const knifeBtn  = this._makeItemBtn(-80,  20, '🗡️ 小刀', hasKnife,  depth + 3, () => this._handleKnife());
    // 催眠药按钮
    const potionBtn = this._makeItemBtn(  0,  20, '💤 催眠药', hasPotion, depth + 3, () => this._handlePotion());
    // 偷偷溜按钮
    const sneakBtn  = this._makeSneakBtn(80, 20, sneakCost, depth + 3, () => this._handleSneak());

    panel.add([gfx, title, ...knifeBtn, ...potionBtn, ...sneakBtn]);
    this._container = { overlay, panel, children: [knifeBtn, potionBtn, sneakBtn].flat() };
  }

  _makeItemBtn(x, y, label, enabled, depth, onClick) {
    const color = enabled ? 0x4caf50 : 0x555555;
    const alpha = enabled ? 1.0     : 0.45;
    const gfx   = this.scene.add.graphics().setDepth(depth);
    gfx.fillStyle(color, alpha);
    gfx.fillRoundedRect(x - 55, y - 22, 110, 48, 10);
    if (enabled) {
      gfx.lineStyle(2, 0xffff88, 0.7);
      gfx.strokeRoundedRect(x - 55, y - 22, 110, 48, 10);
    }

    const text = this.scene.add.text(x, y, label, {
      fontSize: '15px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: enabled ? '#ffffff' : '#aaaaaa', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(depth + 1);

    const hitArea = this.scene.add.rectangle(x, y, 110, 48)
      .setFill(0x000000, 0).setDepth(depth + 2)
      .setInteractive({ cursor: enabled ? 'pointer' : 'not-allowed' });

    if (enabled) {
      hitArea.on('pointerdown', onClick);
    }

    return [gfx, text, hitArea];
  }

  _makeSneakBtn(x, y, cost, depth, onClick) {
    const gfx   = this.scene.add.graphics().setDepth(depth);
    gfx.fillStyle(0xff9800, 0.9);
    gfx.fillRoundedRect(x - 70, y - 22, 140, 48, 10);
    gfx.lineStyle(2, 0xffffff, 0.5);
    gfx.strokeRoundedRect(x - 70, y - 22, 140, 48, 10);

    const text = this.scene.add.text(x, y, `🤫 偷偷溜 ⚡${cost}`, {
      fontSize: '15px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(depth + 1);

    const hitArea = this.scene.add.rectangle(x, y, 140, 48)
      .setFill(0x000000, 0).setDepth(depth + 2)
      .setInteractive({ cursor: 'pointer' });

    hitArea.on('pointerdown', onClick);

    return [gfx, text, hitArea];
  }

  _handleKnife() {
    if (!this.itemModule.hasItem('knife')) return;
    this.itemModule.removeItem('knife');
    this._close();
    this.onKnife?.();
  }

  _handlePotion() {
    if (!this.itemModule.hasItem('potion')) return;
    this.itemModule.removeItem('potion');
    this._close();
    this.onPotion?.();
  }

  _handleSneak() {
    this._close();
    this.onSneak?.();
  }

  _close() {
    if (!this._visible) return;
    this._visible = false;
    if (this._container) {
      this._container.overlay.destroy();
      this._container.panel.destroy();
    }
    this._container = null;
  }

  isVisible() {
    return this._visible;
  }

  destroy() {
    this._close();
  }
}
```

---

## Task 6: MapModule 增强 — `MapModule.js`

**文件:** 修改 `src/modules/MapModule.js`

需要添加 NPC 支持：注册 NPC 实例、渲染 NPC、查询节点关联的 NPC。

- [ ] **Step 1: 在构造函数中追加 NPC 相关属性**

在 `MapModule` 构造函数（`constructor(scene, levelData)`）中，在 `this._highlighted = new Set();` 之后添加：

```javascript
    /** NPC 实例映射 id → NPCModule */
    this._npcs = new Map();
    /** 每个节点关联的 NPC id 集合 */
    this._nodeNpcs = new Map();
```

- [ ] **Step 2: 添加 NPC 注册方法**

在 `_buildGraph()` 方法之后添加：

```javascript
  // ── NPC 管理 ────────────────────────────────────────────
  /**
   * 注册一个 NPC
   * @param {import('../npcs/NPCModule').NPCModule} npc
   */
  registerNPC(npc) {
    this._npcs.set(npc.id, npc);
    npc.bindMap(this);
    // 绑定渲染 Graphics
    const gfx = this.scene.add.graphics().setDepth(50);
    npc.bindGraphics(gfx);
    // 更新节点 → NPC 映射
    for (const nodeId of npc.getTriggerNodeIds()) {
      if (!this._nodeNpcs.has(nodeId)) {
        this._nodeNpcs.set(nodeId, []);
      }
      this._nodeNpcs.get(nodeId).push(npc.id);
    }
  }

  /**
   * 获取某节点关联的 NPC id 列表
   * @param {number} nodeId
   * @returns {string[]}
   */
  getNpcsAtNode(nodeId) {
    return this._nodeNpcs.get(nodeId) ?? [];
  }

  /**
   * 获取某节点关联的、处于阻挡状态的 NPC
   * @param {number} nodeId
   * @returns {import('../npcs/NPCModule').NPCModule[]}
   */
  getBlockingNpcsAtNode(nodeId) {
    return this.getNpcsAtNode(nodeId)
      .map(id => this._npcs.get(id))
      .filter(npc => npc && npc.isBlocking());
  }
```

- [ ] **Step 3: 在 `destroy()` 中清理 NPC**

在 `destroy()` 方法中，在现有循环后追加：

```javascript
    // 清理 NPC
    for (const npc of this._npcs.values()) {
      npc.destroy();
    }
    this._npcs.clear();
    this._nodeNpcs.clear();
```

---

## Task 7: ItemModule 集成到 GameScene — `GameScene.js`

**文件:** 修改 `src/scenes/GameScene.js`

需要：
1. 导入 ItemModule
2. 实例化 ItemModule
3. 在吃食物时触发掉落检测
4. 在 `_onArrived` 中检测 NPC 触发并暂停

- [ ] **Step 1: 在文件顶部 import 中追加 ItemModule**

```javascript
import { ItemModule }  from '../modules/ItemModule.js';
```

- [ ] **Step 2: 在 `init(data)` 中实例化 ItemModule**

在 `init(data)` 中，在 `this._levelId = data?.levelId ?? 1;` 后添加：

```javascript
    this._items = new ItemModule();
```

- [ ] **Step 3: 在 `_onArrived` 中追加食物掉落检测**

找到 `// 拾取食物` 注释块，在 `const gained = this._food.checkPickup(nodeId);` 之后添加：

```javascript
      // 道具掉落检测
      const dropped = this._items.rollDrop(this._food.getLastFoodType?.(nodeId));
      if (dropped) {
        this._items.addItem(dropped);
        const icon = dropped === 'knife' ? '🗡️' : '💤';
        this._ui.showMessage(`${icon} 获得道具！`, 2000);
      }
```

> 注：如果 `FoodModule` 没有 `getLastFoodType()` 方法，需要在 `FoodModule.js` 中添加，或者把掉落逻辑直接放在 `FoodModule` 内部（见 Task 8）。

- [ ] **Step 4: 在 `_onArrived` 开头追加 NPC 检测逻辑**

在 `_onArrived` 函数开头（`if (this._gameOver) return;` 之后）添加：

```javascript
    // ── NPC 触发检测 ─────────────────────────────────────
    const blockingNpcs = this._map.getBlockingNpcsAtNode(nodeId);
    if (blockingNpcs.length > 0) {
      const npc = blockingNpcs[0];  // 取第一个拦路的 NPC
      npc.activate();
      this._showObstaclePanel(npc);
      return;  // 暂停，等待玩家操作
    }
```

- [ ] **Step 5: 在 GameScene 中添加 `_showObstaclePanel` 方法**

在 `_addBackButton()` 方法之前添加：

```javascript
  // ── 道具选择面板 ────────────────────────────────────────
  _showObstaclePanel(npc) {
    const sneakCost = CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;

    this._obstaclePanel = new ObstaclePanel(this, this._items, npc, {
      onKnife: () => this._handleKnife(npc),
      onPotion: () => this._handlePotion(npc),
      onSneak: () => this._handleSneak(npc, sneakCost),
    });
    this._obstaclePanel.show();
  }

  _handleKnife(npc) {
    // 飞刀动画
    this._playKnifeAnimation(npc, () => {
      npc.kill();
      this._resumeAfterObstacle();
    });
  }

  _handlePotion(npc) {
    const duration = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;
    npc.sleep(duration);
    npc.startCountdownUI(this);
    this._resumeAfterObstacle();
  }

  _handleSneak(npc, cost) {
    const sneakCost = CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;
    this._energy.drain(sneakCost);
    this._ui.showMessage(`🤫 偷偷溜过，消耗 ⚡${sneakCost} 能量`, 2000);
    // 青蛙仍存在，下次经过还会触发
    npc.reset();  // 退回 idle 状态但仍然存在
    this._resumeAfterObstacle();
  }

  _resumeAfterObstacle() {
    // NPC 处理完毕后，继续执行本来的到达逻辑
    // 从 pending 队列取出目标，继续前进
    if (this._obstaclePanel) {
      this._obstaclePanel.destroy();
      this._obstaclePanel = null;
    }
    // _pendingTargetNode 是在 moveTo 时记录的，这里直接放行
    // 由于 NPC 触发时移动已经完成（毛毛虫停在触发节点），
    // 所以这里直接刷新高亮，允许玩家继续点击
    this._refreshHighlight();
  }

  // ── 飞刀动画 ──────────────────────────────────────────
  _playKnifeAnimation(npc, onComplete) {
    // 从毛毛虫头部飞向青蛙位置
    const catPos  = this._cat.getHeadPosition?.() ?? { x: 0, y: 0 };
    const nodeA   = npc.edgeA;
    const nodeB   = npc.edgeB;
    const na      = this._map.getNode(nodeA);
    const nb      = this._map.getNode(nodeB);
    if (!na || !nb) { onComplete?.(); return; }
    const targetX = (na.x + nb.x) / 2;
    const targetY = (na.y + nb.y) / 2;

    const knifeGfx = this.scene.add.graphics();
    // 画小刀形状
    knifeGfx.fillStyle(0xcfd8dc, 1);
    knifeGfx.fillRect(-12, -3, 24, 6);
    knifeGfx.fillStyle(0xffd700, 1);
    knifeGfx.fillRect(-4, -6, 8, 12);
    knifeGfx.setPosition(catPos.x, catPos.y);
    knifeGfx.setDepth(200);

    this.scene.tweens.add({
      targets: knifeGfx,
      x: targetX,
      y: targetY,
      angle: 360 * 2,
      duration: 300,
      ease: 'Power1',
      onComplete: () => {
        knifeGfx.destroy();
        onComplete?.();
      },
    });
  }
```

> 注：如果 `CaterpillarModule` 没有 `getHeadPosition()` 方法，在 Task 9 中添加。

---

## Task 8: FoodModule 掉落集成 — `FoodModule.js`

**文件:** 修改 `src/modules/FoodModule.js`

- [ ] **Step 1: 添加 `getLastFoodType` 方法**

在 `checkPickup` 方法之后添加：

```javascript
  /**
   * 查询某节点的食物类型（用于掉落检测）
   * @param {number} nodeId
   * @returns {string|null}
   */
  getLastFoodType(nodeId) {
    return this._foods.get(nodeId)?.type ?? null;
  }
```

---

## Task 9: CaterpillarModule 位置暴露 — `CaterpillarModule.js`

**文件:** 修改 `src/modules/CaterpillarModule.js`

- [ ] **Step 1: 添加 `getHeadPosition` 公开方法**

在 `getCurrentNodeId()` 之后添加：

```javascript
  /**
   * 返回毛毛虫头部当前位置（像素坐标）
   * @returns {{ x: number, y: number }}
   */
  getHeadPosition() {
    const head = this._posHistory[0];
    return head ? { x: head.x, y: head.y } : { x: 0, y: 0 };
  }
```

---

## Task 10: 第一关联入青蛙 — `level1.js`

**文件:** 修改 `src/levels/level1.js`

- [ ] **Step 1: 在关卡数据中添加 npcs 数组**

在 `level1.js` 的 `LEVEL1` 对象中，在 `hint` 字段之后添加：

```javascript
  // NPC 障碍配置
  npcs: [
    {
      id: 'frog_1',
      type: 'frog',
      edgeA: 3,  // 节点 3
      edgeB: 5,  // 节点 5
    },
  ],
```

- [ ] **Step 2: 在 GameScene 的 `create()` 中注册青蛙**

在 `src/scenes/GameScene.js` 的 `create()` 中，找到 `this._cat.create(levelData.startNode);` 这一行，在其之后添加：

```javascript
      // ── 注册 NPC ────────────────────────────────────────
      if (levelData.npcs) {
        for (const npcDef of levelData.npcs) {
          if (npcDef.type === 'frog') {
            const { FrogNPC } = await import('../npcs/FrogNPC.js');
            const frog = new FrogNPC({ id: npcDef.id, edgeA: npcDef.edgeA, edgeB: npcDef.edgeB });
            this._map.registerNPC(frog);
          }
        }
      }
```

> 注意：这里用了 `await import()` 动态导入 FrogNPC。如果想保持静态导入，在文件顶部 `import { LEVEL1 }` 处添加 `import { FrogNPC }` 并在 `create()` 中用 `new FrogNPC()` 直接实例化。

---

## Task 11: 完整性验证

- [ ] **Step 1: 在浏览器中验证**

启动静态服务器 `python3 -m http.server 8080`，打开 `http://localhost:8080`，进入第一关。

验证清单：
- [ ] 正常游戏流程不受影响（能移动到各节点）
- [ ] 到达节点 3 或节点 5 时，青蛙激活，面板弹出
- [ ] 有小刀时点击小刀，飞刀动画，青蛙消失
- [ ] 有催眠药时点击催眠药，青蛙睡着，倒计时气泡显示，5 秒后可再次触发
- [ ] 点击偷偷溜，能量扣除，青蛙重置为 idle
- [ ] 吃食物后有概率获得道具（观察是否有获得道具提示）

---

## 依赖顺序

建议按以下顺序实现：
1. Task 1（config.js）
2. Task 2（ItemModule.js）
3. Task 3（NPCModule.js）
4. Task 4（FrogNPC.js）
5. Task 5（ObstaclePanel.js）
6. Task 6（MapModule.js 修改）
7. Task 7（GameScene.js 修改）
8. Task 8（FoodModule.js 修改）
9. Task 9（CaterpillarModule.js 修改）
10. Task 10（level1.js 修改）
11. Task 11（浏览器验证）
