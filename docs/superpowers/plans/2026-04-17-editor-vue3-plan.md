# 关卡编辑器 Vue 3 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `editor.html` 重构为 Vite + Vue 3 + Pinia 项目，完整保留所有功能，删除旧文件。

**Architecture:** 项目位于 `creator/` 目录下，使用 Pinia 管理全局状态，Phaser 3 继续负责画布渲染，Vue 3 组件化 UI 层，通过 composables 桥接 Phaser 与 Vue 响应式系统。

**Tech Stack:** Vite 5, Vue 3 (Composition API + `<script setup>`), Pinia, Phaser 3.60, 纯 CSS

---

## 文件结构

```
creator/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.js
    ├── App.vue
    ├── styles/
    │   └── main.css
    ├── stores/
    │   └── editorStore.js
    ├── composables/
    │   ├── usePhaserCanvas.js
    │   └── useDragDrop.js
    ├── components/
    │   ├── EditorToolbar.vue
    │   ├── EditorCanvas.vue
    │   ├── EditorPanel.vue
    │   ├── NodeTab.vue
    │   ├── EdgeTab.vue
    │   ├── ItemTab.vue
    │   ├── NpcTab.vue
    │   ├── MetaTab.vue
    │   ├── ToastNotification.vue
    │   └── ImportModal.vue
    └── data/
        └── levelDefaults.js
```

---

## Task 1: 初始化项目脚手架

**Files:**
- Create: `creator/index.html`
- Create: `creator/package.json`
- Create: `creator/vite.config.js`

- [ ] **Step 1: 创建 creator/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>关卡编辑器 — 毛毛虫找家</title>
    <script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: 创建 creator/package.json**

```json
{
  "name": "caterpillar-editor",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "pinia": "^2.1.7",
    "phaser": "^3.60.0",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 3: 创建 creator/vite.config.js**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174
  }
})
```

- [ ] **Step 4: 创建 creator/src/main.js**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

- [ ] **Step 5: 创建 creator/src/App.vue 骨架**

```vue
<template>
  <div id="app-root">编辑器加载中...</div>
</template>

<script setup>
</script>

<style>
#app-root { width: 100vw; height: 100vh; }
</style>
```

- [ ] **Step 6: 安装依赖并验证启动**

Run: `cd creator && npm install && npm run dev -- --host`
Expected: Vite dev server starts on port 5174, page shows "编辑器加载中..."

- [ ] **Step 7: 提交**

```bash
git add creator/ && git commit -m "feat(creator): scaffold Vite + Vue3 project"
```

---

## Task 2: 样式迁移

**Files:**
- Create: `creator/src/styles/main.css`

- [ ] **Step 1: 创建 creator/src/styles/main.css，从 editor.html 提取全部样式**

从 `editor.html` 的 `<style>` 块提取全部 CSS 内容，粘贴至 `main.css`。

- [ ] **Step 2: 更新 App.vue 引入样式**

```vue
<style>
#app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a2e;
  font-family: 'Microsoft YaHei', sans-serif;
  color: #e0e0e0;
  overflow: hidden;
}
</style>
```

- [ ] **Step 3: 验证样式加载**

Run: 启动 dev server，检查编辑器页面样式是否正常渲染（深色主题、工具栏布局）。

- [ ] **Step 4: 提交**

```bash
git add creator/src/styles/main.css creator/src/App.vue && git commit -m "feat(creator): migrate all styles from editor.html"
```

---

## Task 3: Pinia Store — editorStore

**Files:**
- Create: `creator/src/stores/editorStore.js`
- Create: `creator/src/data/levelDefaults.js`

- [ ] **Step 1: 创建 creator/src/data/levelDefaults.js**

```js
export function createDefaultLevel() {
  return {
    id: 1,
    name: '',
    difficulty: '简单',
    startNode: -1,
    homeNode: -1,
    initialEnergy: 120,
    nodes: [],
    edges: [],
    food: [],
    wings: [],
    fastTravel: [],
    npcs: []
  }
}
```

- [ ] **Step 2: 创建 creator/src/stores/editorStore.js**

完整的 Pinia store，包含所有 level 数据操作方法和 UI 状态。

```js
import { defineStore } from 'pinia'
import { createDefaultLevel } from '../data/levelDefaults.js'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    level: createDefaultLevel(),
    selectedId: null,
    activeTool: null,
    connMode: {
      active: false,
      tool: null,
      fromId: null,
      cx: 0,
      cy: 0
    },
    activeTab: 'nodes',
    toast: { show: false, msg: '' },
    showImportModal: false
  }),

  getters: {
    getNode: (state) => (id) => state.level.nodes.find(n => n.id === id),
    getNodeAt: (state) => (x, y, r = 16) => {
      for (const n of state.level.nodes) {
        if (Math.hypot(n.x - x, n.y - y) <= r) return n
      }
      return null
    },
    getEdgeAt: (state) => (x, y) => {
      for (const [a, b] of state.level.edges) {
        const na = state.level.nodes.find(n => n.id === a)
        const nb = state.level.nodes.find(n => n.id === b)
        if (!na || !nb) continue
        const dx = nb.x - na.x, dy = nb.y - na.y, len = Math.hypot(dx, dy)
        if (!len) continue
        const t = Math.max(0, Math.min(1, ((x - na.x) * dx + (y - na.y) * dy) / (len * len)))
        if (Math.hypot(x - (na.x + t * dx), y - (na.y + t * dy)) < 8) return [a, b]
      }
      return null
    }
  },

  actions: {
    addNode(x, y) {
      const id = this.level.nodes.length ? Math.max(...this.level.nodes.map(n => n.id)) + 1 : 0
      this.level.nodes.push({ id, x, y, isStart: false, isHome: false, isDead: false, label: '' })
      return id
    },
    removeNode(id) {
      this.level.nodes = this.level.nodes.filter(n => n.id !== id)
      this.level.edges = this.level.edges.filter(([a, b]) => a !== id && b !== id)
      this.level.food = this.level.food.filter(f => f.nodeId !== id)
      this.level.wings = this.level.wings.filter(w => w.nodeId !== id)
      this.level.fastTravel = this.level.fastTravel.filter(([a, b]) => a !== id && b !== id)
      this.level.npcs = this.level.npcs.filter(n => n.edgeA !== id && n.edgeB !== id)
      if (this.level.startNode === id) this.level.startNode = -1
      if (this.level.homeNode === id) this.level.homeNode = -1
      if (this.selectedId === id) this.selectedId = null
    },
    updateNode(id, f) {
      const n = this.level.nodes.find(n => n.id === id)
      if (!n) return
      Object.assign(n, f)
      if (f.isStart) {
        this.level.nodes.forEach(n2 => n2.id !== id && (n2.isStart = false))
        this.level.startNode = id
      }
      if (f.isHome) {
        this.level.nodes.forEach(n2 => n2.id !== id && (n2.isHome = false))
        this.level.homeNode = id
      }
    },
    select(id) { this.selectedId = id },
    addEdge(a, b) {
      if (a === b) return false
      if (this.level.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return false
      this.level.edges.push([a, b])
      return true
    },
    removeEdge(a, b) {
      this.level.edges = this.level.edges.filter(([x, y]) => !(x === a && y === b) && !(x === b && y === a))
    },
    addFood(nid, t = 'leaf') {
      if (!this.level.food.some(f => f.nodeId === nid)) this.level.food.push({ nodeId: nid, type: t })
    },
    removeFood(nid) { this.level.food = this.level.food.filter(f => f.nodeId !== nid) },
    cycleFood(nid) {
      const ts = ['leaf', 'berry', 'apple']
      const i = this.level.food.findIndex(f => f.nodeId === nid)
      if (i >= 0) {
        const cur = this.level.food[i].type
        const next = ts[(ts.indexOf(cur) + 1) % ts.length]
        if (next === 'leaf') this.removeFood(nid)
        else this.level.food[i].type = next
      } else {
        this.addFood(nid, 'leaf')
      }
    },
    addWing(nid) { if (!this.level.wings.some(w => w.nodeId === nid)) this.level.wings.push({ nodeId: nid }) },
    removeWing(nid) { this.level.wings = this.level.wings.filter(w => w.nodeId !== nid) },
    toggleWing(nid) { this.level.wings.some(w => w.nodeId === nid) ? this.removeWing(nid) : this.addWing(nid) },
    addFT(a, b) {
      if (a === b) return false
      if (this.level.fastTravel.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return false
      this.level.fastTravel.push([a, b])
      return true
    },
    removeFT(a, b) { this.level.fastTravel = this.level.fastTravel.filter(([x, y]) => !(x === a && y === b) && !(x === b && y === a)) },
    addNPC(eA, eB) {
      const id = 'npc_' + Date.now()
      this.level.npcs.push({ id, type: 'frog', edgeA: eA, edgeB: eB, sneakEnergyCost: 20 })
      return id
    },
    removeNPC(id) { this.level.npcs = this.level.npcs.filter(n => n.id !== id) },
    updateNPC(id, f) { const n = this.level.npcs.find(n => n.id === id); if (n) Object.assign(n, f) },
    setConnFrom(id) { this.connMode.fromId = id },
    cancelConnMode() { this.connMode.active = false; this.connMode.tool = null; this.connMode.fromId = null },
    showToast(msg) { this.toast.show = true; this.toast.msg = msg; setTimeout(() => { this.toast.show = false }, 2500) },
    toJSON() { return JSON.parse(JSON.stringify(this.level)) },
    fromJSON(o) { this.level = JSON.parse(JSON.stringify(o)); this.selectedId = null },
    reset() {
      this.level = createDefaultLevel()
      this.selectedId = null
      this.activeTool = null
      this.connMode.active = false
    }
  }
})
```

- [ ] **Step 3: 提交**

```bash
git add creator/src/stores/editorStore.js creator/src/data/levelDefaults.js && git commit -m "feat(creator): implement Pinia editorStore with all level operations"
```

---

## Task 4: usePhaserCanvas Composable

**Files:**
- Create: `creator/src/composables/usePhaserCanvas.js`

- [ ] **Step 1: 创建 creator/src/composables/usePhaserCanvas.js**

桥接 Phaser 与 Vue 的核心 composable，管理 Phaser 实例生命周期和重绘逻辑。

```js
import { ref, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editorStore.js'

const CW = 800, CH = 600, NR = 14

export function usePhaserCanvas(containerRef) {
  const store = useEditorStore()
  let game = null
  let scene = null
  const phaserReady = ref(false)

  function redraw() {
    if (!scene) return
    scene.children.list.filter(c => c.getData && c.getData('fl')).forEach(c => c.destroy())
    scene.edgeGfx.clear()
    scene.ftGfx.clear()
    scene.nodeGfx.clear()
    scene.lblGfx.clear()
    scene.ovGfx.clear()
    scene.foodGfx.clear()

    const level = store.level

    // 边
    for (const [a, b] of level.edges) {
      const na = store.getNode(a), nb = store.getNode(b)
      if (!na || !nb) continue
      scene.edgeGfx.lineStyle(6, 0x6d4c2f, 1); scene.edgeGfx.beginPath()
      scene.edgeGfx.moveTo(na.x, na.y); scene.edgeGfx.lineTo(nb.x, nb.y); scene.edgeGfx.strokePath()
      scene.edgeGfx.lineStyle(3, 0x5a3e1b, 1); scene.edgeGfx.beginPath()
      scene.edgeGfx.moveTo(na.x, na.y); scene.edgeGfx.lineTo(nb.x, nb.y); scene.edgeGfx.strokePath()
    }

    // 快速通道
    for (const [a, b] of level.fastTravel) {
      const na = store.getNode(a), nb = store.getNode(b)
      if (!na || !nb) continue
      const dx = nb.x - na.x, dy = nb.y - na.y, total = Math.hypot(dx, dy)
      if (!total) continue
      const ux = dx / total, uy = dy / total
      let d = 0, on = true
      scene.ftGfx.lineStyle(3, 0xffd700, 0.7)
      while (d < total) {
        const seg = on ? 12 : 8
        scene.ftGfx.beginPath()
        scene.ftGfx.moveTo(na.x + ux * d, na.y + uy * d)
        scene.ftGfx.lineTo(na.x + ux * Math.min(d + seg, total), na.y + uy * Math.min(d + seg, total))
        scene.ftGfx.strokePath()
        d += seg; on = !on
      }
    }

    // 节点
    for (const n of level.nodes) {
      const c = n.isStart ? 0x4CAF50 : n.isHome ? 0xFF5722 : n.isDead ? 0x9e9e9e : 0x8d6e63
      scene.nodeGfx.fillStyle(0x000000, 0.2); scene.nodeGfx.fillCircle(n.x + 2, n.y + 2, NR)
      scene.nodeGfx.fillStyle(c, 1); scene.nodeGfx.fillCircle(n.x, n.y, NR)
      scene.nodeGfx.lineStyle(2, 0xffffff, 0.5); scene.nodeGfx.strokeCircle(n.x, n.y, NR)
      scene.lblGfx.fillStyle(0x000000, 0.7); scene.lblGfx.fillCircle(n.x, n.y, 7)
      scene.lblGfx.fillStyle(0xffffff, 1); scene.lblGfx.fillCircle(n.x, n.y, 5)
    }

    // 食物
    for (const f of level.food) {
      const n = store.getNode(f.nodeId)
      if (!n) continue
      const cols = { leaf: 0x4CAF50, berry: 0xE91E63, apple: 0xF44336 }
      scene.foodGfx.fillStyle(cols[f.type] ?? 0x4CAF50, 0.9); scene.foodGfx.fillCircle(n.x, n.y - 22, 9)
      const t = scene.add.text(n.x + 12, n.y - 22, f.type, {
        fontSize: '10px', color: '#fff', backgroundColor: '#333', padding: { x: 3, y: 1 }
      }).setOrigin(0, 0.5).setDepth(100)
      t.setData('fl', true)
    }

    // 翅膀
    for (const w of level.wings) {
      const n = store.getNode(w.nodeId)
      if (!n) continue
      scene.foodGfx.fillStyle(0x9C27B0, 0.8); scene.foodGfx.fillEllipse(n.x, n.y - 38, 18, 12)
      scene.foodGfx.fillStyle(0xE1BEE7, 0.6); scene.foodGfx.fillEllipse(n.x, n.y - 38, 12, 7)
    }

    // NPC
    for (const npc of level.npcs) {
      const na = store.getNode(npc.edgeA), nb = store.getNode(npc.edgeB)
      if (!na || !nb) continue
      const mx = (na.x + nb.x) / 2, my = (na.y + nb.y) / 2
      scene.foodGfx.fillStyle(0x388e3c, 1); scene.foodGfx.fillEllipse(mx, my, 22, 18)
      scene.foodGfx.fillStyle(0x81c784, 1); scene.foodGfx.fillEllipse(mx, my + 4, 14, 11)
      scene.foodGfx.fillStyle(0xffffff, 1); scene.foodGfx.fillCircle(mx - 7, my - 9, 6); scene.foodGfx.fillCircle(mx + 7, my - 9, 6)
      scene.foodGfx.fillStyle(0x1b5e20, 1); scene.foodGfx.fillCircle(mx - 7, my - 9, 3); scene.foodGfx.fillCircle(mx + 7, my - 9, 3)
    }

    // 选中高亮
    if (store.selectedId !== null) {
      const n = store.getNode(store.selectedId)
      if (n) {
        scene.ovGfx.lineStyle(3, 0xe94560, 1); scene.ovGfx.strokeCircle(n.x, n.y, 20)
        scene.ovGfx.lineStyle(2, 0xe94560, 0.25); scene.ovGfx.fillCircle(n.x, n.y, 24)
      }
    }

    // 连接橡皮筋
    if (store.connMode.active && store.connMode.fromId !== null) {
      const from = store.getNode(store.connMode.fromId)
      if (from) {
        const col = store.connMode.tool === 'fasttravel' ? 0xffd700 : 0x4CAF50
        scene.ovGfx.lineStyle(3, col, 0.85); scene.ovGfx.beginPath()
        scene.ovGfx.moveTo(from.x, from.y)
        scene.ovGfx.lineTo(store.connMode.cx, store.connMode.cy)
        scene.ovGfx.strokePath()
        scene.ovGfx.lineStyle(2, col, 0.6); scene.ovGfx.strokeCircle(store.connMode.cx, store.connMode.cy, 10)
      }
    }
  }

  function initPhaser() {
    const Phaser = window.Phaser
    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: CW,
      height: CH,
      parent: containerRef.value,
      backgroundColor: '#87CEEB',
      scene: {
        create() {
          scene = this
          scene.add.graphics().fillGradientStyle(0x87CEEB, 0x87CEEB, 0xB0E0E6, 0xB0E0E6, 1).fillRect(0, 0, CW, CH)
          const g = scene.add.graphics()
          g.fillStyle(0x4a9e30, 0.55)
          for (let i = 0; i < 20; i++) { const bx = 30 + i * 40; g.fillTriangle(bx, CH, bx - 12, CH - 30, bx + 12, CH - 30) }
          scene.edgeGfx = scene.add.graphics()
          scene.ftGfx = scene.add.graphics()
          scene.nodeGfx = scene.add.graphics()
          scene.lblGfx = scene.add.graphics()
          scene.ovGfx = scene.add.graphics()
          scene.foodGfx = scene.add.graphics()

          scene.input.on('pointerdown', onDown)
          scene.input.on('pointermove', onMove)
          scene.input.on('pointerup', onUp)

          phaserReady.value = true
          redraw()
        }
      }
    })
  }

  function onDown(pointer) {
    const wx = pointer.x, wy = pointer.y
    const node = store.getNodeAt(wx, wy)

    if (store.connMode.active) {
      if (node) {
        if (store.connMode.fromId === null) {
          store.setConnFrom(node.id)
          store.select(node.id)
        } else if (node.id !== store.connMode.fromId) {
          if (store.connMode.tool === 'edge') store.addEdge(store.connMode.fromId, node.id)
          else if (store.connMode.tool === 'fasttravel') store.addFT(store.connMode.fromId, node.id)
          else if (store.connMode.tool === 'npc') store.addNPC(store.connMode.fromId, node.id)
          store.cancelConnMode()
        }
      } else {
        store.cancelConnMode()
      }
      return
    }

    if (node) {
      store.select(node.id)
      scene._mv = { active: true, node, ox: wx - node.x, oy: wy - node.y }
      redraw()
    } else {
      store.select(null)
      redraw()
    }
  }

  function onMove(pointer) {
    const wx = pointer.x, wy = pointer.y

    if (scene._mv && scene._mv.active) {
      const m = scene._mv
      m.node.x = Math.max(NR, Math.min(CW - NR, wx - m.ox))
      m.node.y = Math.max(NR, Math.min(CH - NR, wy - m.oy))
      redraw()
    }

    if (store.connMode.active) {
      store.connMode.cx = Math.max(0, Math.min(CW, wx))
      store.connMode.cy = Math.max(0, Math.min(CH, wy))
      redraw()
    }
  }

  function onUp() {
    if (scene._mv) { scene._mv.active = false; scene._mv = null }
  }

  return { phaserReady, redraw, initPhaser, destroyPhaser() { if (game) { game.destroy(true); game = null; scene = null; phaserReady.value = false } } }
}
```

- [ ] **Step 2: 提交**

```bash
git add creator/src/composables/usePhaserCanvas.js && git commit -m "feat(creator): implement usePhaserCanvas composable"
```

---

## Task 5: useDragDrop Composable

**Files:**
- Create: `creator/src/composables/useDragDrop.js`

- [ ] **Step 1: 创建 creator/src/composables/useDragDrop.js**

```js
import { ref } from 'vue'
import { useEditorStore } from '../stores/editorStore.js'

const NR = 14
const GHOST_TEXT = { node: '⚫ 节点', edge: '━━ 边', fasttravel: '⚡ 快速通道', npc: '🐸 NPC', food: '🍎 食物', wing: '🪁 翅膀' }

export function useDragDrop() {
  const store = useEditorStore()
  const dragging = ref({ active: false, tool: null })

  function onToolbarMousedown(e, tool) {
    e.preventDefault()
    dragging.value.active = true
    dragging.value.tool = tool
    e.target.closest('.tool-item')?.classList.add('dragging')
    const ghost = document.getElementById('ghost')
    if (ghost) {
      ghost.textContent = GHOST_TEXT[tool] || tool
      ghost.style.display = 'block'
      ghost.style.left = e.clientX + 'px'
      ghost.style.top = e.clientY + 'px'
    }
  }

  function onMousemove(e) {
    const ghost = document.getElementById('ghost')
    if (dragging.value.active && ghost) {
      ghost.style.left = e.clientX + 'px'
      ghost.style.top = e.clientY + 'px'
    }
    const trashZone = document.getElementById('trash-zone')
    if (!trashZone) return
    const rect = trashZone.getBoundingClientRect()
    const onTrash = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
    trashZone.classList.toggle('hover', onTrash)
  }

  function onMouseup(e) {
    const ghost = document.getElementById('ghost')
    if (ghost) ghost.style.display = 'none'
    document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('dragging'))

    if (!dragging.value.active) return
    const tool = dragging.value.tool
    dragging.value.active = false
    dragging.value.tool = null

    const wrap = document.getElementById('canvas-wrap')
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const onCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom

    if (!onCanvas) return

    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const targetNode = store.level.nodes.find(n => Math.hypot(n.x - cx, n.y - cy) <= NR)

    if (tool === 'node') {
      const id = store.addNode(cx, cy)
      store.select(id)
    } else if (tool === 'edge' || tool === 'fasttravel' || tool === 'npc') {
      store.connMode.active = true
      store.connMode.tool = tool
      store.connMode.fromId = null
      store.connMode.cx = cx
      store.connMode.cy = cy
    } else if (tool === 'food') {
      if (targetNode) { store.cycleFood(targetNode.id); store.select(targetNode.id) }
      else store.showToast('请将食物拖到节点上')
    } else if (tool === 'wing') {
      if (targetNode) { store.toggleWing(targetNode.id); store.select(targetNode.id) }
      else store.showToast('请将翅膀拖到节点上')
    }
  }

  return { dragging, onToolbarMousedown, onMousemove, onMouseup }
}
```

- [ ] **Step 2: 提交**

```bash
git add creator/src/composables/useDragDrop.js && git commit -m "feat(creator): implement useDragDrop composable"
```

---

## Task 6: EditorCanvas + EditorToolbar 组件

**Files:**
- Create: `creator/src/components/EditorCanvas.vue`
- Create: `creator/src/components/EditorToolbar.vue`
- Modify: `creator/src/App.vue`

- [ ] **Step 1: 创建 EditorCanvas.vue**

```vue
<template>
  <div id="canvas-wrap">
    <div ref="canvasRef" id="game-container"></div>
    <div id="mode-bar">{{ modeBarText }}</div>
    <div id="coord-bar">{{ coordBarText }}</div>
    <div id="trash-zone" @mouseup="onTrashMouseup">🗑<span>删除</span></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editorStore.js'
import { usePhaserCanvas } from '../composables/usePhaserCanvas.js'

const store = useEditorStore()
const canvasRef = ref(null)
const coordBarText = ref('就绪')

const { phaserReady, redraw, initPhaser, destroyPhaser } = usePhaserCanvas(canvasRef)

const modeBarText = computed(() => {
  if (store.connMode.active) {
    const msgs = { edge: '请选择边的终点节点（右键取消）', fasttravel: '请选择快速通道的终点节点（右键取消）', npc: '请选择 NPC 的终点节点（右键取消）' }
    if (store.connMode.fromId === null) return '请选择起点节点'
    return msgs[store.connMode.tool] || ''
  }
  return '拖拽上方工具到画布放置'
})

watch(() => store.level, () => { if (phaserReady.value) redraw() }, { deep: true })
watch(() => store.selectedId, () => {
  if (store.selectedId !== null) {
    const n = store.getNode(store.selectedId)
    if (n) coordBarText.value = `x:${Math.round(n.x)}  y:${Math.round(n.y)}`
  } else {
    coordBarText.value = '就绪'
  }
  if (phaserReady.value) redraw()
})

onMounted(() => { initPhaser() })
onUnmounted(() => { destroyPhaser() })

function onTrashMouseup(e) {
  const rect = document.getElementById('canvas-wrap').getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const node = store.getNodeAt(cx, cy, 30)
  if (node) { store.removeNode(node.id); return }
  const edge = store.getEdgeAt(cx, cy)
  if (edge) store.removeEdge(edge[0], edge[1])
}

onMounted(() => {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    if (store.connMode.active) store.cancelConnMode()
  })
})
</script>

<style scoped>
#canvas-wrap {
  flex: 0 0 800px;
  position: relative;
  overflow: hidden;
  border-right: 1px solid #0f3460;
}
</style>
```

- [ ] **Step 2: 创建 EditorToolbar.vue**

```vue
<template>
  <div id="toolbar">
    <h1>关卡编辑器</h1>

    <div class="tool-item" id="tool-node" @mousedown="e => onMousedown(e, 'node')">
      <span class="icon">⚫</span><span class="label">节点</span>
    </div>

    <div class="tool-sep"></div>

    <div class="tool-item" id="tool-edge" @mousedown="e => onMousedown(e, 'edge')">
      <span class="icon">━━</span><span class="label">边</span>
    </div>

    <div class="tool-item" id="tool-fasttravel" @mousedown="e => onMousedown(e, 'fasttravel')">
      <span class="icon">⚡</span><span class="label">快速通道</span>
    </div>

    <div class="tool-item" id="tool-npc" @mousedown="e => onMousedown(e, 'npc')">
      <span class="icon">🐸</span><span class="label">NPC</span>
    </div>

    <div class="tool-sep"></div>

    <div class="tool-item" id="tool-food" @mousedown="e => onMousedown(e, 'food')">
      <span class="icon">🍎</span><span class="label">食物</span>
    </div>

    <div class="tool-item" id="tool-wing" @mousedown="e => onMousedown(e, 'wing')">
      <span class="icon">🪁</span><span class="label">翅膀</span>
    </div>

    <div class="tool-sep"></div>
    <button class="btn primary" id="btn-export" @click="onExport">📤 导出</button>
    <button class="btn" id="btn-import" @click="store.showImportModal = true">📥 导入</button>
  </div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
import { useDragDrop } from '../composables/useDragDrop.js'

const store = useEditorStore()
const { onToolbarMousedown } = useDragDrop()

function onMousedown(e, tool) { onToolbarMousedown(e, tool) }

function onExport() {
  navigator.clipboard.writeText(JSON.stringify(store.toJSON(), null, 2))
    .then(() => store.showToast('✅ JSON 已复制到剪贴板！'))
    .catch(() => store.showToast('⚠️ 复制失败'))
}
</script>
```

- [ ] **Step 3: 更新 App.vue 组装完整布局**

```vue
<template>
  <div id="app-root">
    <EditorToolbar />
    <div id="main">
      <EditorCanvas />
      <EditorPanel />
    </div>
    <ToastNotification />
    <ImportModal v-if="store.showImportModal" />
    <div id="ghost"></div>
  </div>
</template>

<script setup>
import { useEditorStore } from './stores/editorStore.js'
import EditorToolbar from './components/EditorToolbar.vue'
import EditorCanvas from './components/EditorCanvas.vue'
import EditorPanel from './components/EditorPanel.vue'
import ToastNotification from './components/ToastNotification.vue'
import ImportModal from './components/ImportModal.vue'

const store = useEditorStore()
</script>
```

- [ ] **Step 4: 提交**

```bash
git add creator/src/components/EditorCanvas.vue creator/src/components/EditorToolbar.vue creator/src/App.vue && git commit -m "feat(creator): add EditorCanvas and EditorToolbar components"
```

---

## Task 7: EditorPanel + 所有 Tab 组件

**Files:**
- Create: `creator/src/components/EditorPanel.vue`
- Create: `creator/src/components/NodeTab.vue`
- Create: `creator/src/components/EdgeTab.vue`
- Create: `creator/src/components/ItemTab.vue`
- Create: `creator/src/components/NpcTab.vue`
- Create: `creator/src/components/MetaTab.vue`

- [ ] **Step 1: 创建 EditorPanel.vue**

```vue
<template>
  <div id="panel">
    <div class="tabs">
      <div v-for="tab in tabs" :key="tab.key" class="tab" :class="{ active: store.activeTab === tab.key }" @click="store.activeTab = tab.key">
        {{ tab.label }}
      </div>
    </div>
    <NodeTab v-if="store.activeTab === 'nodes'" />
    <EdgeTab v-if="store.activeTab === 'edges'" />
    <ItemTab v-if="store.activeTab === 'items'" />
    <NpcTab v-if="store.activeTab === 'npcs'" />
    <MetaTab v-if="store.activeTab === 'meta'" />
  </div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
import NodeTab from './NodeTab.vue'
import EdgeTab from './EdgeTab.vue'
import ItemTab from './ItemTab.vue'
import NpcTab from './NpcTab.vue'
import MetaTab from './MetaTab.vue'

const store = useEditorStore()
const tabs = [
  { key: 'nodes', label: '节点' },
  { key: 'edges', label: '边' },
  { key: 'items', label: '道具' },
  { key: 'npcs', label: 'NPC' },
  { key: 'meta', label: '基础' }
]
</script>
```

- [ ] **Step 2: 创建 NodeTab.vue**

```vue
<template>
  <div class="tab-content active">
    <div class="section-title">节点列表（点击选中，拖动移动）</div>
    <div class="node-list">
      <div v-if="!store.level.nodes.length" style="color:#555;font-size:12px">无节点</div>
      <div
        v-for="n in store.level.nodes" :key="n.id"
        class="list-item" :class="{ selected: store.selectedId === n.id }"
        @click="store.select(n.id)"
      >
        节点 {{ n.id }} ({{ Math.round(n.x) }},{{ Math.round(n.y) }})
        {{ n.isStart ? '🏁' : '' }}{{ n.isHome ? '🏠' : '' }}{{ n.isDead ? '💀' : '' }}
      </div>
    </div>
    <div class="section-title">属性</div>
    <template v-if="selectedNode">
      <div class="prop-row"><label class="prop-label">id</label><input :value="selectedNode.id" type="text" readonly></div>
      <div class="prop-row"><label class="prop-label">x</label><input :value="Math.round(selectedNode.x)" type="number" @input="e => selectedNode.x = parseFloat(e.target.value) || 0"></div>
      <div class="prop-row"><label class="prop-label">y</label><input :value="Math.round(selectedNode.y)" type="number" @input="e => selectedNode.y = parseFloat(e.target.value) || 0"></div>
      <div class="prop-row"><label class="prop-label">标签</label><input :value="selectedNode.label" type="text" @input="e => selectedNode.label = e.target.value"></div>
      <div class="prop-row"><label><input type="checkbox" :checked="selectedNode.isStart" @change="e => store.updateNode(selectedNode.id, { isStart: e.target.checked })"> 起点</label></div>
      <div class="prop-row"><label><input type="checkbox" :checked="selectedNode.isHome" @change="e => store.updateNode(selectedNode.id, { isHome: e.target.checked })"> 终点</label></div>
      <div class="prop-row"><label><input type="checkbox" :checked="selectedNode.isDead" @change="e => store.updateNode(selectedNode.id, { isDead: e.target.checked })"> 死路</label></div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useEditorStore } from '../stores/editorStore.js'

const store = useEditorStore()
const selectedNode = computed(() => store.selectedId !== null ? store.getNode(store.selectedId) : null)
</script>
```

- [ ] **Step 3: 创建 EdgeTab.vue**

```vue
<template>
  <div class="tab-content active">
    <div class="section-title">所有边（拖入画布创建）</div>
    <div class="edge-list">
      <div v-if="!store.level.edges.length" style="color:#555;font-size:12px">无边</div>
      <div v-for="([a, b]) in store.level.edges" :key="`${a}-${b}`" class="list-item">
        <span>{{ a }} ↔ {{ b }}</span>
        <span class="del" @click="store.removeEdge(a, b)">✕</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
const store = useEditorStore()
</script>
```

- [ ] **Step 4: 创建 ItemTab.vue**

```vue
<template>
  <div class="tab-content active">
    <div class="section-title">食物</div>
    <div class="item-list">
      <div v-if="!store.level.food.length" style="color:#555;font-size:12px">无食物</div>
      <div v-for="f in store.level.food" :key="f.nodeId" class="list-item">
        <span>{{ foodEmo[f.type] }} 节点{{ f.nodeId }}: {{ f.type }}</span>
        <span class="del" @click="store.removeFood(f.nodeId)">✕</span>
      </div>
    </div>
    <div class="section-title">翅膀</div>
    <div class="item-list">
      <div v-if="!store.level.wings.length" style="color:#555;font-size:12px">无翅膀</div>
      <div v-for="w in store.level.wings" :key="w.nodeId" class="list-item">
        <span>🪁 节点 {{ w.nodeId }}</span>
        <span class="del" @click="store.removeWing(w.nodeId)">✕</span>
      </div>
    </div>
    <div class="section-title">快速通道</div>
    <div class="item-list">
      <div v-if="!store.level.fastTravel.length" style="color:#555;font-size:12px">无快速通道</div>
      <div v-for="([a, b]) in store.level.fastTravel" :key="`ft-${a}-${b}`" class="list-item">
        <span>⚡ [{{ a }} ↔ {{ b }}]</span>
        <span class="del" @click="store.removeFT(a, b)">✕</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
const store = useEditorStore()
const foodEmo = { leaf: '🍃', berry: '🫐', apple: '🍎' }
</script>
```

- [ ] **Step 5: 创建 NpcTab.vue**

```vue
<template>
  <div class="tab-content active">
    <div class="section-title">NPC 列表</div>
    <div v-if="!store.level.npcs.length" style="color:#555;font-size:12px">无 NPC</div>
    <div v-for="npc in store.level.npcs" :key="npc.id" class="npc-card">
      <div class="npc-card-header">
        <span>🐸 {{ npc.id }}</span>
        <span class="del" style="color:#e94560;cursor:pointer;" @click="store.removeNPC(npc.id)">✕ 删除</span>
      </div>
      <div class="prop-row">
        <label class="prop-label">edgeA</label>
        <select :value="npc.edgeA" @change="e => store.updateNPC(npc.id, { edgeA: parseInt(e.target.value) })">
          <option value="-1">—</option>
          <option v-for="n in store.level.nodes" :key="n.id" :value="n.id">节点 {{ n.id }}</option>
        </select>
      </div>
      <div class="prop-row">
        <label class="prop-label">edgeB</label>
        <select :value="npc.edgeB" @change="e => store.updateNPC(npc.id, { edgeB: parseInt(e.target.value) })">
          <option value="-1">—</option>
          <option v-for="n in store.level.nodes" :key="n.id" :value="n.id">节点 {{ n.id }}</option>
        </select>
      </div>
      <div class="prop-row">
        <label class="prop-label">能量消耗</label>
        <input type="number" :value="npc.sneakEnergyCost" @change="e => store.updateNPC(npc.id, { sneakEnergyCost: parseInt(e.target.value) || 20 })">
      </div>
    </div>
  </div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
const store = useEditorStore()
</script>
```

- [ ] **Step 6: 创建 MetaTab.vue**

```vue
<template>
  <div class="tab-content active">
    <div class="prop-row"><label class="prop-label">名称</label><input :value="store.level.name" type="text" @input="e => store.level.name = e.target.value"></div>
    <div class="prop-row">
      <label class="prop-label">难度</label>
      <select :value="store.level.difficulty" @change="e => store.level.difficulty = e.target.value">
        <option value="简单">简单</option><option value="普通">普通</option><option value="困难">困难</option>
      </select>
    </div>
    <div class="prop-row"><label class="prop-label">初始能量</label><input :value="store.level.initialEnergy" type="number" @change="e => store.level.initialEnergy = parseInt(e.target.value) || 120"></div>
    <div class="prop-row">
      <label class="prop-label">起点节点</label>
      <select :value="store.level.startNode" @change="e => { const id = parseInt(e.target.value); if(id >= 0) store.updateNode(id, { isStart: true }); store.level.startNode = id }">
        <option value="-1">—</option>
        <option v-for="n in store.level.nodes" :key="n.id" :value="n.id">节点 {{ n.id }}</option>
      </select>
    </div>
    <div class="prop-row">
      <label class="prop-label">终点节点</label>
      <select :value="store.level.homeNode" @change="e => { const id = parseInt(e.target.value); if(id >= 0) store.updateNode(id, { isHome: true }); store.level.homeNode = id }">
        <option value="-1">—</option>
        <option v-for="n in store.level.nodes" :key="n.id" :value="n.id">节点 {{ n.id }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
const store = useEditorStore()
</script>
```

- [ ] **Step 7: 提交**

```bash
git add creator/src/components/EditorPanel.vue creator/src/components/NodeTab.vue creator/src/components/EdgeTab.vue creator/src/components/ItemTab.vue creator/src/components/NpcTab.vue creator/src/components/MetaTab.vue && git commit -m "feat(creator): add EditorPanel and all tab components"
```

---

## Task 8: ToastNotification + ImportModal 组件

**Files:**
- Create: `creator/src/components/ToastNotification.vue`
- Create: `creator/src/components/ImportModal.vue`

- [ ] **Step 1: 创建 ToastNotification.vue**

```vue
<template>
  <div id="toast" :class="{ show: store.toast.show }">{{ store.toast.msg }}</div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
const store = useEditorStore()
</script>
```

- [ ] **Step 2: 创建 ImportModal.vue**

```vue
<template>
  <div id="import-modal" class="show" @click.self="store.showImportModal = false">
    <div class="modal-box">
      <h3>导入 JSON</h3>
      <textarea v-model="importText" placeholder="粘贴 JSON 内容..."></textarea>
      <div class="modal-actions">
        <button class="btn" @click="store.showImportModal = false">取消</button>
        <button class="btn primary" @click="onConfirm">导入</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editorStore.js'

const store = useEditorStore()
const importText = ref('')

function onConfirm() {
  try {
    store.fromJSON(JSON.parse(importText.value.trim()))
    store.showImportModal = false
    store.showToast('✅ JSON 导入成功！')
  } catch (e) {
    store.showToast('❌ JSON 格式错误')
  }
}

function onKeydown(e) { if (e.key === 'Escape') store.showImportModal = false }
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>
```

- [ ] **Step 3: 提交**

```bash
git add creator/src/components/ToastNotification.vue creator/src/components/ImportModal.vue && git commit -m "feat(creator): add ToastNotification and ImportModal components"
```

---

## Task 9: 集成验证

- [ ] **Step 1: 启动并验证**

Run: `cd creator && npm install && npm run dev -- --host`
打开 http://localhost:5174，验证：
- [ ] 工具栏显示正常（节点、边、快速通道、NPC、食物、翅膀按钮）
- [ ] 拖拽节点工具到画布可创建节点，节点显示正确颜色（起点绿、终点橙、死路灰）
- [ ] 选中节点后右侧面板显示属性，可编辑坐标和标签
- [ ] 拖拽边工具，连接两个节点创建边
- [ ] 拖拽食物到节点上可添加食物，切换类型
- [ ] 导出按钮复制 JSON 到剪贴板
- [ ] 导入弹窗可导入 JSON
- [ ] 删除节点/边功能正常（拖入垃圾桶）

---

## Task 10: 删除旧文件并完成

**Files:**
- Delete: `editor.html`

- [ ] **Step 1: 删除旧 editor.html**

Run: `rm /Users/mac/Documents/cxq/caterpillar-game/editor.html`

- [ ] **Step 2: 提交**

```bash
git rm editor.html && git commit -m "chore: remove legacy editor.html, replaced by Vue3 creator app"
```

---

## 自检清单

1. **Spec 覆盖**: 所有设计 spec 中的功能均有对应任务实现，无遗漏。
2. **Placeholder 扫描**: 无 "TBD"、"TODO"、不完整步骤。
3. **类型一致性**: `store.getNode(id)` / `store.getNodeAt(x,y)` / `store.removeNode(id)` 等方法名在各任务中保持一致。
4. **路径正确性**: 所有文件路径使用 `creator/src/...` 前缀，符合项目根目录下的 `creator/` 子目录约定。
