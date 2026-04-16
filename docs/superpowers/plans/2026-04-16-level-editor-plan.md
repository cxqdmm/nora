# 关卡编辑器实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建独立网页 `editor.html`，在 800×600 可视化画布上编辑关卡数据，导出 JSON 供游戏使用。

**Architecture:** 单文件 HTML，内嵌 CSS + JavaScript。Phaser 3 用于画布渲染；原生 DOM/CSS 实现右侧面板；纯内存数据模型，导出时序列化为 JSON。

**Tech Stack:** Phaser 3 (CDN), 原生 HTML/CSS/JS，无框架，无构建步骤。

---

## 文件清单

- 新建: `editor.html` — 编辑器全部代码（HTML + CSS + JS，内嵌 Phaser 场景）

---

## 数据模型

编辑器的关卡状态保存在 `window.editorLevel` 全局对象中，结构同设计文档 JSON。提供 `EditorLevel` 类封装所有读写操作：

```js
class EditorLevel {
  constructor()
  // 节点操作
  addNode(x, y)          // 返回新节点 id
  removeNode(id)
  updateNode(id, fields) // {x, y, isStart, isHome, isDead, label}
  getNode(id)
  // 边操作
  addEdge(a, b)
  removeEdge(a, b)
  getEdgesForNode(id)    // 返回所有关联边 [[a,b], ...]
  // 道具操作
  addFood(nodeId, type)
  removeFood(nodeId)
  addWing(nodeId)
  removeWing(nodeId)
  addFastTravel(a, b)
  removeFastTravel(a, b)
  // NPC 操作
  addNPC(edgeA, edgeB)
  removeNPC(id)
  updateNPC(id, fields)
  // 基础信息
  setMeta(fields)
  toJSON()              // 导出对象
  fromJSON(obj)         // 导入
}
```

---

## 阶段一：HTML 骨架 + 布局 + CSS

### Task 1: 创建 editor.html 基础结构

- [ ] **Step 1: 创建 `editor.html`，写入 HTML 骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>关卡编辑器 — 毛毛虫找家</title>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { display: flex; flex-direction: column; height: 100vh; background: #1a1a2e; font-family: 'Microsoft YaHei', sans-serif; color: #e0e0e0; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    // 代码逐步填入此处
  </script>
</body>
</html>
```

- [ ] **Step 2: 添加 CSS 布局**

在 `<style>` 中写入：

```css
#topbar {
  display: flex; align-items: center; gap: 8px;
  background: #16213e; padding: 8px 16px; border-bottom: 1px solid #0f3460;
}
#topbar h1 { font-size: 16px; color: #e94560; margin-right: 16px; }
.toolbar { display: flex; gap: 4px; }
.tool-btn {
  width: 36px; height: 36px; border: 1px solid #0f3460; border-radius: 6px;
  background: #1a1a2e; color: #e0e0e0; cursor: pointer; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
}
.tool-btn.active { background: #e94560; border-color: #e94560; color: #fff; }
.sep { width: 1px; height: 28px; background: #0f3460; margin: 0 8px; }
.action-btn {
  padding: 6px 14px; border: 1px solid #0f3460; border-radius: 6px;
  background: #1a1a2e; color: #e0e0e0; cursor: pointer; font-size: 13px;
}
.action-btn:hover { background: #0f3460; }
.action-btn.export { background: #0f3460; color: #e94560; font-weight: bold; }
#main { display: flex; flex: 1; overflow: hidden; }
#canvas-wrap { flex: 0 0 800px; position: relative; }
#coord-bar {
  position: absolute; bottom: 0; left: 0; right: 0; background: rgba(22,33,62,0.85);
  padding: 4px 12px; font-size: 12px; color: #aaa; pointer-events: none;
}
#panel {
  flex: 1; background: #16213e; display: flex; flex-direction: column; overflow: hidden;
}
.tabs { display: flex; border-bottom: 1px solid #0f3460; }
.tab {
  padding: 8px 14px; cursor: pointer; font-size: 13px; color: #888;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab.active { color: #e94560; border-bottom-color: #e94560; }
.tab-content { flex: 1; overflow-y: auto; padding: 12px; display: none; }
.tab-content.active { display: block; }
.section-title { font-size: 12px; color: #e94560; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 1px; }
.prop-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; }
.prop-label { color: #aaa; min-width: 60px; }
input[type="text"], input[type="number"], select {
  background: #1a1a2e; border: 1px solid #0f3460; border-radius: 4px;
  color: #e0e0e0; padding: 4px 8px; font-size: 13px; width: 100%;
}
input[type="checkbox"] { width: 16px; height: 16px; accent-color: #e94560; }
input[type="range"] { width: 100%; }
.node-list, .edge-list, .item-list, .npc-list { display: flex; flex-direction: column; gap: 4px; }
.list-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  background: #1a1a2e; border-radius: 4px; cursor: pointer; font-size: 13px;
}
.list-item.selected { background: #0f3460; border: 1px solid #e94560; }
.list-item .del {
  margin-left: auto; color: #e94560; cursor: pointer; font-size: 14px; user-select: none;
}
.npc-card {
  background: #1a1a2e; border-radius: 6px; padding: 10px; margin-bottom: 8px; font-size: 13px;
}
.npc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
#toast {
  position: fixed; bottom: 20px; right: 20px; background: #e94560; color: #fff;
  padding: 10px 18px; border-radius: 8px; font-size: 14px;
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
#toast.show { opacity: 1; }
#import-modal {
  display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  align-items: center; justify-content: center; z-index: 1000;
}
#import-modal.show { display: flex; }
.modal-box { background: #16213e; border-radius: 10px; padding: 20px; width: 500px; }
.modal-box h3 { color: #e94560; margin-bottom: 12px; }
.modal-box textarea { width: 100%; height: 200px; background: #1a1a2e; border: 1px solid #0f3460; border-radius: 6px; color: #e0e0e0; padding: 8px; font-family: monospace; font-size: 12px; resize: vertical; }
.modal-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }
```

- [ ] **Step 3: 添加 HTML 主体结构**

在 `<body>` 中写入：

```html
<div id="topbar">
  <h1>🎮 关卡编辑器</h1>
  <div class="toolbar">
    <button class="tool-btn active" data-mode="select" title="选择 / 移动">⬚</button>
    <button class="tool-btn" data-mode="node" title="添加节点">○+</button>
    <button class="tool-btn" data-mode="edge" title="添加边">─□</button>
    <button class="tool-btn" data-mode="delete" title="删除">🗑</button>
    <button class="tool-btn" data-mode="food" title="放置食物">🍎</button>
    <button class="tool-btn" data-mode="wing" title="放置翅膀">🪁</button>
    <button class="tool-btn" data-mode="fasttravel" title="快速通道">⚡</button>
    <button class="tool-btn" data-mode="npc" title="添加 NPC">🐸</button>
  </div>
  <div class="sep"></div>
  <button class="action-btn export" id="btn-export">📤 导出 JSON</button>
  <button class="action-btn" id="btn-import">📥 导入 JSON</button>
</div>

<div id="main">
  <div id="canvas-wrap">
    <div id="game-container"></div>
    <div id="coord-bar">就绪</div>
  </div>

  <div id="panel">
    <div class="tabs">
      <div class="tab active" data-tab="nodes">节点</div>
      <div class="tab" data-tab="edges">边</div>
      <div class="tab" data-tab="items">道具</div>
      <div class="tab" data-tab="npcs">NPC</div>
      <div class="tab" data-tab="meta">基础</div>
    </div>

    <div class="tab-content active" id="tab-nodes">
      <div class="section-title">节点列表</div>
      <div class="node-list" id="node-list"></div>
      <div class="section-title">属性</div>
      <div class="prop-row"><label class="prop-label">id</label><input id="prop-id" type="text" readonly></div>
      <div class="prop-row"><label class="prop-label">x</label><input id="prop-x" type="number"></div>
      <div class="prop-row"><label class="prop-label">y</label><input id="prop-y" type="number"></div>
      <div class="prop-row"><label class="prop-label">label</label><input id="prop-label" type="text"></div>
      <div class="prop-row"><label><input id="prop-start" type="checkbox"> 起点 (Start)</label></div>
      <div class="prop-row"><label><input id="prop-home" type="checkbox"> 终点 (Home)</label></div>
      <div class="prop-row"><label><input id="prop-dead" type="checkbox"> 死路 (Dead)</label></div>
    </div>

    <div class="tab-content" id="tab-edges">
      <div class="section-title">所有边</div>
      <div class="edge-list" id="edge-list"></div>
    </div>

    <div class="tab-content" id="tab-items">
      <div class="section-title">食物</div>
      <div class="item-list" id="food-list"></div>
      <div class="section-title">翅膀</div>
      <div class="item-list" id="wing-list"></div>
      <div class="section-title">快速通道</div>
      <div class="item-list" id="ft-list"></div>
    </div>

    <div class="tab-content" id="tab-npcs">
      <div class="section-title">NPC 列表</div>
      <div id="npc-cards"></div>
    </div>

    <div class="tab-content" id="tab-meta">
      <div class="prop-row"><label class="prop-label">name</label><input id="meta-name" type="text"></div>
      <div class="prop-row"><label class="prop-label">难度</label>
        <select id="meta-difficulty">
          <option value="简单">简单</option>
          <option value="普通">普通</option>
          <option value="困难">困难</option>
        </select>
      </div>
      <div class="prop-row"><label class="prop-label">初始能量</label><input id="meta-energy" type="number"></div>
      <div class="prop-row"><label class="prop-label">起点节点</label>
        <select id="meta-start"></select>
      </div>
      <div class="prop-row"><label class="prop-label">终点节点</label>
        <select id="meta-home"></select>
      </div>
    </div>
  </div>
</div>

<div id="toast"></div>

<div id="import-modal">
  <div class="modal-box">
    <h3>导入 JSON</h3>
    <textarea id="import-text" placeholder="粘贴 JSON 内容..."></textarea>
    <div class="modal-actions">
      <button class="action-btn" id="import-cancel">取消</button>
      <button class="action-btn export" id="import-confirm">导入</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: 提交**

```bash
git add editor.html && git commit -m "feat(editor): scaffold HTML structure and CSS layout"
```

---

## 阶段二：数据模型 + Phaser 画布渲染

### Task 2: 实现 EditorLevel 数据类

- [ ] **Step 1: 在 `<script>` 顶部写入 `EditorLevel` 类**

```js
class EditorLevel {
  constructor() {
    this.data = {
      id: 1, name: '', difficulty: '简单', startNode: -1, homeNode: -1,
      initialEnergy: 120,
      nodes: [],
      edges: [],
      food: [],
      wings: [],
      fastTravel: [],
      npcs: [],
    };
  }

  // 节点
  addNode(x, y) {
    const id = this._nextId();
    this.data.nodes.push({ id, x, y, isStart: false, isHome: false, isDead: false, label: '' });
    return id;
  }
  _nextId() {
    return this.data.nodes.length === 0 ? 0 : Math.max(...this.data.nodes.map(n => n.id)) + 1;
  }
  removeNode(id) {
    this.data.nodes = this.data.nodes.filter(n => n.id !== id);
    this.data.edges = this.data.edges.filter(([a, b]) => a !== id && b !== id);
    this.data.food = this.data.food.filter(f => f.nodeId !== id);
    this.data.wings = this.data.wings.filter(w => w.nodeId !== id);
    this.data.fastTravel = this.data.fastTravel.filter(([a, b]) => a !== id && b !== id);
    this.data.npcs = this.data.npcs.filter(n => n.edgeA !== id && n.edgeB !== id);
    if (this.data.startNode === id) this.data.startNode = -1;
    if (this.data.homeNode === id) this.data.homeNode = -1;
  }
  updateNode(id, fields) {
    const n = this.data.nodes.find(n => n.id === id);
    if (!n) return;
    Object.assign(n, fields);
    if (fields.isStart) { this.data.nodes.forEach(n2 => n2.id !== id && (n2.isStart = false)); this.data.startNode = id; }
    if (fields.isHome)  { this.data.nodes.forEach(n2 => n2.id !== id && (n2.isHome = false)); this.data.homeNode = id; }
  }
  getNode(id) { return this.data.nodes.find(n => n.id === id); }

  // 边
  addEdge(a, b) {
    if (a === b) return false;
    const exists = this.data.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    if (exists) return false;
    this.data.edges.push([a, b]);
    return true;
  }
  removeEdge(a, b) { this.data.edges = this.data.edges.filter(([x, y]) => !(x === a && y === b) && !(x === b && y === a)); }
  getEdgesForNode(id) { return this.data.edges.filter(([a, b]) => a === id || b === id); }

  // 食物
  addFood(nodeId, type = 'leaf') {
    if (this.data.food.some(f => f.nodeId === nodeId)) return;
    this.data.food.push({ nodeId, type });
  }
  removeFood(nodeId) { this.data.food = this.data.food.filter(f => f.nodeId !== nodeId); }
  cycleFood(nodeId) {
    const types = ['leaf', 'berry', 'apple'];
    const idx = this.data.food.findIndex(f => f.nodeId === nodeId);
    if (idx >= 0) {
      const cur = this.data.food[idx].type;
      const next = types[(types.indexOf(cur) + 1) % types.length];
      if (next === 'leaf') { this.removeFood(nodeId); } else { this.data.food[idx].type = next; }
    } else {
      this.data.food.push({ nodeId, type: 'leaf' });
    }
  }

  // 翅膀
  addWing(nodeId) { if (!this.data.wings.some(w => w.nodeId === nodeId)) this.data.wings.push({ nodeId }); }
  removeWing(nodeId) { this.data.wings = this.data.wings.filter(w => w.nodeId !== nodeId); }
  hasWing(nodeId) { return this.data.wings.some(w => w.nodeId === nodeId); }
  toggleWing(nodeId) { if (this.hasWing(nodeId)) this.removeWing(nodeId); else this.addWing(nodeId); }

  // 快速通道
  addFastTravel(a, b) {
    if (a === b) return false;
    const exists = this.data.fastTravel.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    if (exists) return false;
    this.data.fastTravel.push([a, b]);
    return true;
  }
  removeFastTravel(a, b) { this.data.fastTravel = this.data.fastTravel.filter(([x, y]) => !(x === a && y === b) && !(x === b && y === a)); }

  // NPC
  addNPC(edgeA, edgeB) {
    const id = 'npc_' + Date.now();
    this.data.npcs.push({ id, type: 'frog', edgeA, edgeB, sneakEnergyCost: 20 });
    return id;
  }
  removeNPC(id) { this.data.npcs = this.data.npcs.filter(n => n.id !== id); }
  updateNPC(id, fields) { const n = this.data.npcs.find(n => n.id === id); if (n) Object.assign(n, fields); }

  // 元信息
  setMeta(fields) { Object.assign(this.data, fields); }
  toJSON() { return JSON.parse(JSON.stringify(this.data)); }
  fromJSON(obj) { this.data = JSON.parse(JSON.stringify(obj)); }
}
```

- [ ] **Step 2: 创建全局实例**

```js
const level = new EditorLevel();
```

- [ ] **Step 3: 提交**

```bash
git add editor.html && git commit -m "feat(editor): add EditorLevel data model class"
```

---

### Task 3: Phaser 画布渲染

- [ ] **Step 1: 定义 Phaser 配置并初始化**

```js
const PHASER_CONFIG = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#87CEEB',
  scene: { create, update },
};

const game = new Phaser.Game(PHASER_CONFIG);

let editorScene;
function create() {
  editorScene = this;
  // 画背景
  this.add.graphics().fillGradientStyle(0x87CEEB, 0x87CEEB, 0xB0E0E6, 0xB0E0E6, 1)
    .fillRect(0, 0, 800, 600);
  // 草地
  const g = this.add.graphics();
  g.fillStyle(0x4a9e30, 0.6);
  for (let i = 0; i < 20; i++) {
    const bx = 30 + i * 40;
    g.fillTriangle(bx, 600, bx - 12, 570, bx + 12, 570);
  }
  // 节点层（Graphics）
  editorScene.nodeGfx = this.add.graphics();
  editorScene.edgeGfx = this.add.graphics();
  editorScene.labelGfx = this.add.graphics();
  editorScene.overlayGfx = this.add.graphics(); // 高亮/选中效果
  editorScene.foodGfx = this.add.graphics();
  editorScene.ftGfx = this.add.graphics();
  // 初始渲染
  redrawAll();
}

function redrawAll() {
  if (!editorScene) return;
  editorScene.edgeGfx.clear();
  editorScene.nodeGfx.clear();
  editorScene.labelGfx.clear();
  editorScene.overlayGfx.clear();
  editorScene.foodGfx.clear();
  editorScene.ftGfx.clear();

  // 边
  for (const [a, b] of level.data.edges) {
    const na = level.getNode(a), nb = level.getNode(b);
    if (!na || !nb) continue;
    editorScene.edgeGfx.lineStyle(6, 0x6d4c2f, 1);
    editorScene.edgeGfx.beginPath();
    editorScene.edgeGfx.moveTo(na.x, na.y);
    editorScene.edgeGfx.lineTo(nb.x, nb.y);
    editorScene.edgeGfx.strokePath();
    // 树皮纹理（中间加粗）
    editorScene.edgeGfx.lineStyle(4, 0x5a3e1b, 1);
    editorScene.edgeGfx.beginPath();
    editorScene.edgeGfx.moveTo(na.x, na.y);
    editorScene.edgeGfx.lineTo(nb.x, nb.y);
    editorScene.edgeGfx.strokePath();
  }

  // 快速通道虚线
  for (const [a, b] of level.data.fastTravel) {
    const na = level.getNode(a), nb = level.getNode(b);
    if (!na || !nb) continue;
    editorScene.ftGfx.lineStyle(3, 0xffd700, 0.6);
    const dx = nb.x - na.x, dy = nb.y - na.y;
    const total = Math.hypot(dx, dy);
    const segLen = 12, gapLen = 8;
    const ux = dx / total, uy = dy / total;
    let dist = 0, dashOn = true;
    while (dist < total) {
      const seg = dashOn ? segLen : gapLen;
      const cx = ux * dist, cy = uy * dist;
      editorScene.ftGfx.beginPath();
      editorScene.ftGfx.moveTo(na.x + cx, na.y + cy);
      editorScene.ftGfx.lineTo(na.x + ux * Math.min(dist + seg, total), na.y + uy * Math.min(dist + seg, total));
      editorScene.ftGfx.strokePath();
      dist += seg; dashOn = !dashOn;
    }
  }

  // 节点
  for (const node of level.data.nodes) {
    const color = node.isStart ? 0x4CAF50 : node.isHome ? 0xFF5722 : node.isDead ? 0x9e9e9e : 0x8d6e63;
    const r = 14;
    // 阴影
    editorScene.nodeGfx.fillStyle(0x000000, 0.2);
    editorScene.nodeGfx.fillCircle(node.x + 2, node.y + 2, r);
    // 节点本体
    editorScene.nodeGfx.fillStyle(color, 1);
    editorScene.nodeGfx.fillCircle(node.x, node.y, r);
    editorScene.nodeGfx.lineStyle(2, 0xffffff, 0.5);
    editorScene.nodeGfx.strokeCircle(node.x, node.y, r);
    // 节点 id
    editorScene.labelGfx.fillStyle(0xffffff, 1);
    editorScene.labelGfx.fillRect(node.x - 5, node.y - 5, 10, 10);
    editorScene.labelGfx.lineStyle(0);
    editorScene.labelGfx.beginPath();
    editorScene.labelGfx.fillStyle(0x000000, 1);
    editorScene.labelGfx.fillCircle(node.x, node.y, 6);
    editorScene.labelGfx.fillStyle(0xffffff, 1);
    editorScene.labelGfx.fillCircle(node.x, node.y, 5);
  }

  // 食物
  for (const f of level.data.food) {
    const n = level.getNode(f.nodeId);
    if (!n) continue;
    const colors = { leaf: 0x4CAF50, berry: 0xE91E63, apple: 0xF44336 };
    const emojimap = { leaf: '🍃', berry: '🫐', apple: '🍎' };
    editorScene.foodGfx.fillStyle(colors[f.type] ?? 0x4CAF50, 0.9);
    editorScene.foodGfx.fillCircle(n.x, n.y - 24, 8);
    // 文字标注类型
    const t = editorScene.add.text(n.x + 10, n.y - 28, f.type, {
      fontSize: '10px', color: '#fff', backgroundColor: '#333', padding: { x: 3, y: 1 }
    }).setOrigin(0, 0.5);
    t.setData('type', 'food-label');
  }

  // 翅膀
  for (const w of level.data.wings) {
    const n = level.getNode(w.nodeId);
    if (!n) continue;
    editorScene.foodGfx.fillStyle(0x9C27B0, 0.8);
    editorScene.foodGfx.fillEllipse(n.x, n.y - 24, 14, 10);
    editorScene.foodGfx.fillStyle(0xE1BEE7, 0.6);
    editorScene.foodGfx.fillEllipse(n.x, n.y - 24, 10, 6);
  }

  // NPC
  for (const npc of level.data.npcs) {
    const na = level.getNode(npc.edgeA), nb = level.getNode(npc.edgeB);
    if (!na || !nb) continue;
    const mx = (na.x + nb.x) / 2, my = (na.y + nb.y) / 2;
    editorScene.foodGfx.fillStyle(0x388e3c, 1);
    editorScene.foodGfx.fillEllipse(mx, my, 20, 16);
    editorScene.foodGfx.fillStyle(0x81c784, 1);
    editorScene.foodGfx.fillEllipse(mx, my + 4, 12, 10);
    // 青蛙眼睛
    editorScene.foodGfx.fillStyle(0xffffff, 1);
    editorScene.foodGfx.fillCircle(mx - 6, my - 8, 5);
    editorScene.foodGfx.fillCircle(mx + 6, my - 8, 5);
    editorScene.foodGfx.fillStyle(0x1b5e20, 1);
    editorScene.foodGfx.fillCircle(mx - 6, my - 8, 3);
    editorScene.foodGfx.fillCircle(mx + 6, my - 8, 3);
  }

  // 选中节点高亮
  if (selectedNodeId !== null) {
    const n = level.getNode(selectedNodeId);
    if (n) {
      editorScene.overlayGfx.lineStyle(3, 0xe94560, 1);
      editorScene.overlayGfx.strokeCircle(n.x, n.y, 20);
      editorScene.overlayGfx.lineStyle(2, 0xe94560, 0.3);
      editorScene.overlayGfx.fillCircle(n.x, n.y, 24);
    }
  }

  // 待确认的边（edge 模式第一点）
  if (edgePending) {
    const n = level.getNode(edgePending);
    if (n) {
      editorScene.overlayGfx.lineStyle(2, 0x4CAF50, 0.8);
      editorScene.overlayGfx.strokeCircle(n.x, n.y, 22);
    }
  }
}
```

- [ ] **Step 2: 清理旧食物标签（redrawAll 调用前）**

在 `redrawAll` 函数开头添加清理：

```js
if (editorScene) {
  editorScene.children.list.filter(c => c.getData && c.getData('type') === 'food-label').forEach(c => c.destroy());
}
```

- [ ] **Step 3: 添加交互变量**

在 `level = new EditorLevel()` 下方添加：

```js
let selectedNodeId = null;
let edgePending = null;    // edge 模式待确认第一点
let ftPending = null;      // fasttravel 模式待确认第一点
let npcPending = null;     // npc 模式待确认第一点
let currentMode = 'select';
let dragNode = null;
let dragOffsetX = 0, dragOffsetY = 0;
```

- [ ] **Step 4: 在 `create()` 末尾添加鼠标事件监听**

```js
this.input.on('pointerdown', onPointerDown, this);
this.input.on('pointermove', onPointerMove, this);
this.input.on('pointerup',   onPointerUp,   this);
```

- [ ] **Step 5: 实现交互处理函数**

```js
const NODE_RADIUS = 14;

function getNodeAt(x, y) {
  for (const node of level.data.nodes) {
    if (Math.hypot(node.x - x, node.y - y) <= NODE_RADIUS + 4) return node;
  }
  return null;
}

function onPointerDown(pointer) {
  const worldX = pointer.x, worldY = pointer.y;
  const node = getNodeAt(worldX, worldY);

  if (currentMode === 'select') {
    if (node) {
      selectedNodeId = node.id;
      dragNode = node;
      dragOffsetX = worldX - node.x;
      dragOffsetY = worldY - node.y;
      updatePanel('nodes');
      updateCoordBar(node.x, node.y);
    } else {
      selectedNodeId = null;
      updatePanel('nodes');
      document.getElementById('coord-bar').textContent = '就绪';
    }
    redrawAll();

  } else if (currentMode === 'node') {
    if (!node) {
      const id = level.addNode(worldX, worldY);
      selectedNodeId = id;
      updateAllPanels();
      refreshNodeSelects();
      redrawAll();
    }

  } else if (currentMode === 'edge') {
    if (node) {
      if (edgePending === null) {
        edgePending = node.id;
      } else {
        level.addEdge(edgePending, node.id);
        edgePending = null;
        updatePanel('edges');
        redrawAll();
      }
    }

  } else if (currentMode === 'delete') {
    if (node) {
      level.removeNode(node.id);
      if (selectedNodeId === node.id) selectedNodeId = null;
      updateAllPanels();
      refreshNodeSelects();
    } else {
      // 检查是否点中边
      const edge = getEdgeAt(worldX, worldY);
      if (edge) { level.removeEdge(edge[0], edge[1]); updatePanel('edges'); }
    }
    redrawAll();

  } else if (currentMode === 'food') {
    if (node) { level.cycleFood(node.id); updatePanel('items'); refreshFoodList(); redrawAll(); }

  } else if (currentMode === 'wing') {
    if (node) { level.toggleWing(node.id); updatePanel('items'); refreshWingList(); redrawAll(); }

  } else if (currentMode === 'fasttravel') {
    if (node) {
      if (ftPending === null) { ftPending = node.id; }
      else { level.addFastTravel(ftPending, node.id); ftPending = null; updatePanel('items'); refreshFTList(); redrawAll(); }
    }

  } else if (currentMode === 'npc') {
    if (node) {
      if (npcPending === null) { npcPending = node.id; }
      else {
        level.addNPC(npcPending, node.id);
        npcPending = null;
        updatePanel('npcs');
        refreshNPCList();
        redrawAll();
      }
    }
  }
}

function onPointerMove(pointer) {
  if (currentMode === 'select' && dragNode) {
    dragNode.x = Math.max(14, Math.min(786, pointer.x - dragOffsetX));
    dragNode.y = Math.max(14, Math.min(586, pointer.y - dragOffsetY));
    updateCoordBar(dragNode.x, dragNode.y);
    // 实时更新属性面板
    document.getElementById('prop-x').value = Math.round(dragNode.x);
    document.getElementById('prop-y').value = Math.round(dragNode.y);
    redrawAll();
  }
}

function onPointerUp() {
  dragNode = null;
}

function getEdgeAt(x, y) {
  for (const [a, b] of level.data.edges) {
    const na = level.getNode(a), nb = level.getNode(b);
    if (!na || !nb) continue;
    const dx = nb.x - na.x, dy = nb.y - na.y;
    const len = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, ((x - na.x) * dx + (y - na.y) * dy) / (len * len)));
    const projX = na.x + t * dx, projY = na.y + t * dy;
    if (Math.hypot(x - projX, y - projY) < 8) return [a, b];
  }
  return null;
}

function updateCoordBar(x, y) {
  document.getElementById('coord-bar').textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
}
```

- [ ] **Step 6: 提交**

```bash
git add editor.html && git commit -m "feat(editor): Phaser canvas rendering and node/edge interaction"
```

---

## 阶段三：右侧面板

### Task 4: 工具条切换 + 面板基础

- [ ] **Step 1: 添加工具条切换逻辑**

```js
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    edgePending = null;
    ftPending = null;
    npcPending = null;
    redrawAll();
  });
});
```

- [ ] **Step 2: 标签页切换逻辑**

```js
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});
```

- [ ] **Step 3: 添加工厂函数 `updateAllPanels()` 和各面板刷新函数**

```js
function updateAllPanels() {
  updatePanel('nodes');
  updatePanel('edges');
  updatePanel('items');
  updatePanel('npcs');
  updatePanel('meta');
}

function updatePanel(tab) {
  if (tab === 'nodes') refreshNodeList();
  if (tab === 'edges') refreshEdgeList();
  if (tab === 'items') { refreshFoodList(); refreshWingList(); refreshFTList(); }
  if (tab === 'npcs') refreshNPCList();
  if (tab === 'meta') refreshMetaPanel();
}

// 节点列表
function refreshNodeList() {
  const list = document.getElementById('node-list');
  list.innerHTML = '';
  for (const n of level.data.nodes) {
    const div = document.createElement('div');
    div.className = 'list-item' + (selectedNodeId === n.id ? ' selected' : '');
    div.textContent = `节点 ${n.id} (${Math.round(n.x)}, ${Math.round(n.y)})`;
    div.addEventListener('click', () => {
      selectedNodeId = n.id;
      updatePanel('nodes');
      redrawAll();
    });
    list.appendChild(div);
  }
}

// 边列表
function refreshEdgeList() {
  const list = document.getElementById('edge-list');
  list.innerHTML = '';
  for (const [a, b] of level.data.edges) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<span>${a} ↔ ${b}</span><span class="del">✕</span>`;
    div.querySelector('.del').addEventListener('click', (e) => { e.stopPropagation(); level.removeEdge(a, b); refreshEdgeList(); redrawAll(); });
    list.appendChild(div);
  }
}

// 食物列表
function refreshFoodList() {
  const list = document.getElementById('food-list');
  list.innerHTML = '';
  for (const f of level.data.food) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<span>节点${f.nodeId}: <select data-node="${f.nodeId}">
      <option value="leaf"${f.type==='leaf'?' selected':''}>🍃 leaf</option>
      <option value="berry"${f.type==='berry'?' selected':''}>🫐 berry</option>
      <option value="apple"${f.type==='apple'?' selected':''}>🍎 apple</option>
    </select></span><span class="del">✕</span>`;
    div.querySelector('select').addEventListener('change', e => { f.type = e.target.value; redrawAll(); });
    div.querySelector('.del').addEventListener('click', ev => { ev.stopPropagation(); level.removeFood(f.nodeId); refreshFoodList(); redrawAll(); });
    list.appendChild(div);
  }
}

// 翅膀列表
function refreshWingList() {
  const list = document.getElementById('wing-list');
  list.innerHTML = '';
  for (const w of level.data.wings) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<span>🪁 节点 ${w.nodeId}</span><span class="del">✕</span>`;
    div.querySelector('.del').addEventListener('click', ev => { ev.stopPropagation(); level.removeWing(w.nodeId); refreshWingList(); redrawAll(); });
    list.appendChild(div);
  }
}

// 快速通道列表
function refreshFTList() {
  const list = document.getElementById('ft-list');
  list.innerHTML = '';
  for (const [a, b] of level.data.fastTravel) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<span>⚡ [${a} ↔ ${b}]</span><span class="del">✕</span>`;
    div.querySelector('.del').addEventListener('click', ev => { ev.stopPropagation(); level.removeFastTravel(a, b); refreshFTList(); redrawAll(); });
    list.appendChild(div);
  }
}

// NPC 列表
function refreshNPCList() {
  const container = document.getElementById('npc-cards');
  container.innerHTML = '';
  for (const npc of level.data.npcs) {
    const card = document.createElement('div');
    card.className = 'npc-card';
    card.innerHTML = `
      <div class="npc-header"><span>🐸 ${npc.id}</span><span class="del" style="color:#e94560;cursor:pointer;">✕ 删除</span></div>
      <div class="prop-row"><label class="prop-label">edgeA</label><select data-npc="${npc.id}" data-field="edgeA">${nodeOptions(npc.edgeA)}</select></div>
      <div class="prop-row"><label class="prop-label">edgeB</label><select data-npc="${npc.id}" data-field="edgeB">${nodeOptions(npc.edgeB)}</select></div>
      <div class="prop-row"><label class="prop-label">能量消耗</label><input type="number" value="${npc.sneakEnergyCost}" data-npc="${npc.id}" data-field="sneakEnergyCost"></div>
    `;
    card.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('change', e => {
        level.updateNPC(e.target.dataset.npc, { [e.target.dataset.field]: parseInt(e.target.value) });
        redrawAll();
      });
    });
    card.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', e => {
        level.updateNPC(e.target.dataset.npc, { [e.target.dataset.field]: parseInt(e.target.value) });
      });
    });
    card.querySelector('.del').addEventListener('click', () => {
      level.removeNPC(npc.id);
      refreshNPCList();
      redrawAll();
    });
    container.appendChild(card);
  }
}

function nodeOptions(selectedId = -1) {
  let s = '<option value="-1">—</option>';
  for (const n of level.data.nodes) s += `<option value="${n.id}"${n.id === selectedId ? ' selected' : ''}>节点 ${n.id}</option>`;
  return s;
}

// 基础信息面板
function refreshMetaPanel() {
  document.getElementById('meta-name').value = level.data.name;
  document.getElementById('meta-difficulty').value = level.data.difficulty;
  document.getElementById('meta-energy').value = level.data.initialEnergy;
  document.getElementById('meta-start').innerHTML = nodeOptions(level.data.startNode);
  document.getElementById('meta-home').innerHTML = nodeOptions(level.data.homeNode);
}

function refreshNodeSelects() {
  document.getElementById('meta-start').innerHTML = nodeOptions(level.data.startNode);
  document.getElementById('meta-home').innerHTML = nodeOptions(level.data.homeNode);
}
```

- [ ] **Step 4: 节点属性面板双向同步**

```js
// 属性面板编辑 → 数据 → 画布
function bindNodePropInputs() {
  const inputs = ['prop-x', 'prop-y', 'prop-label'];
  inputs.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (selectedNodeId === null) return;
      level.updateNode(selectedNodeId, {
        x: parseFloat(document.getElementById('prop-x').value) || 0,
        y: parseFloat(document.getElementById('prop-y').value) || 0,
        label: document.getElementById('prop-label').value,
      });
      refreshNodeList();
      redrawAll();
    });
  });
  ['prop-start', 'prop-home', 'prop-dead'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      if (selectedNodeId === null) return;
      level.updateNode(selectedNodeId, {
        isStart: document.getElementById('prop-start').checked,
        isHome: document.getElementById('prop-home').checked,
        isDead: document.getElementById('prop-dead').checked,
      });
      refreshNodeList();
      refreshNodeSelects();
      redrawAll();
    });
  });
}

// 节点选中 → 更新属性面板显示
function updateNodeProps() {
  const n = selectedNodeId !== null ? level.getNode(selectedNodeId) : null;
  if (!n) {
    document.getElementById('prop-id').value = '';
    document.getElementById('prop-x').value = '';
    document.getElementById('prop-y').value = '';
    document.getElementById('prop-label').value = '';
    document.getElementById('prop-start').checked = false;
    document.getElementById('prop-home').checked = false;
    document.getElementById('prop-dead').checked = false;
    return;
  }
  document.getElementById('prop-id').value = n.id;
  document.getElementById('prop-x').value = Math.round(n.x);
  document.getElementById('prop-y').value = Math.round(n.y);
  document.getElementById('prop-label').value = n.label;
  document.getElementById('prop-start').checked = n.isStart;
  document.getElementById('prop-home').checked = n.isHome;
  document.getElementById('prop-dead').checked = n.isDead;
}
```

- [ ] **Step 5: 修改 `updatePanel('nodes')` 调用改为同时更新属性面板**

将 `refreshNodeList()` 替换为调用：

```js
function updatePanel(tab) {
  if (tab === 'nodes') { refreshNodeList(); updateNodeProps(); }
  // ... 其余不变
}
```

- [ ] **Step 6: 基础信息面板绑定**

```js
document.getElementById('meta-name').addEventListener('input', e => { level.data.name = e.target.value; });
document.getElementById('meta-difficulty').addEventListener('change', e => { level.data.difficulty = e.target.value; });
document.getElementById('meta-energy').addEventListener('change', e => { level.data.initialEnergy = parseInt(e.target.value) || 120; });
document.getElementById('meta-start').addEventListener('change', e => {
  const id = parseInt(e.target.value);
  if (id >= 0) level.updateNode(id, { isStart: true });
  level.data.startNode = id;
});
document.getElementById('meta-home').addEventListener('change', e => {
  const id = parseInt(e.target.value);
  if (id >= 0) level.updateNode(id, { isHome: true });
  level.data.homeNode = id;
});
```

- [ ] **Step 7: 在 `create()` 末尾调用初始化并绑定事件**

```js
// 绑定属性面板
bindNodePropInputs();
// 初始化面板
updateAllPanels();
```

- [ ] **Step 8: 提交**

```bash
git add editor.html && git commit -m "feat(editor): right panel tabs and node property binding"
```

---

## 阶段四：导出 / 导入

### Task 5: 导出 + 导入功能

- [ ] **Step 1: Toast 提示函数**

```js
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
```

- [ ] **Step 2: 导出 JSON 按钮**

```js
document.getElementById('btn-export').addEventListener('click', () => {
  // 补全 id
  level.data.id = 1;
  const json = level.toJSON();
  navigator.clipboard.writeText(JSON.stringify(json, null, 2)).then(() => {
    showToast('✅ JSON 已复制到剪贴板！');
  }).catch(() => {
    showToast('⚠️ 复制失败，请手动复制');
  });
});
```

- [ ] **Step 3: 导入 JSON 模态框**

```js
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-modal').classList.add('show');
  document.getElementById('import-text').value = '';
});

document.getElementById('import-cancel').addEventListener('click', () => {
  document.getElementById('import-modal').classList.remove('show');
});

document.getElementById('import-confirm').addEventListener('click', () => {
  const text = document.getElementById('import-text').value.trim();
  try {
    const data = JSON.parse(text);
    level.fromJSON(data);
    selectedNodeId = null;
    updateAllPanels();
    refreshNodeSelects();
    redrawAll();
    document.getElementById('import-modal').classList.remove('show');
    showToast('✅ JSON 导入成功！');
  } catch (e) {
    showToast('❌ JSON 格式错误：' + e.message);
  }
});
```

- [ ] **Step 4: ESC 关闭导入框**

```js
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('import-modal').classList.remove('show');
});
```

- [ ] **Step 5: 提交**

```bash
git add editor.html && git commit -m "feat(editor): export/import JSON functionality"
```

---

## 阶段五：测试 + 收尾

### Task 6: 最终检查

- [ ] **Step 1: 检查是否覆盖了设计文档所有验收标准**

逐条对照 `docs/superpowers/specs/2026-04-16-level-editor-design.md` 的验收标准：
1. ✅ 添加/移动/删除节点 — Task 2 (EditorLevel) + Task 3 (Phaser 交互)
2. ✅ 创建/删除边 — Task 2 + Task 3
3. ✅ 节点属性同步 — Task 4 (面板绑定)
4. ✅ 食物/翅膀/快速通道/NPC 的增删 — Task 2 + Task 3
5. ✅ 导出 JSON 格式正确 — Task 5
6. ✅ 导入 JSON 还原关卡 — Task 5

- [ ] **Step 2: 在浏览器中打开 `editor.html` 验证以下场景**

1. 点击画布空白处 → 添加节点（node 模式）
2. 切换选择模式 → 拖拽节点
3. edge 模式 → 依次点击两节点 → 边出现
4. 放置食物 → 节点旁出现圆点标注
5. 导出 JSON → 复制成功提示
6. 导入 `level1.js` 的 JSON → 关卡还原正确

- [ ] **Step 3: 最终提交**

```bash
git add editor.html && git commit -m "feat: complete level editor with all features

- Phaser 3 canvas with drag-to-move nodes
- 8 tool modes: select/node/edge/delete/food/wing/fasttravel/npc
- Right panel with 5 tabs: nodes/edges/items/npcs/meta
- Import/export JSON with clipboard support

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
"
```
