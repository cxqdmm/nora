# 关卡编辑器 Vue 3 重构设计

**日期**: 2026-04-17
**状态**: 已批准，待实施

## 1. 目标

将 `editor.html`（Phaser 3 纯原生 JS 关卡编辑器）重构为 Vue 3 + Vite 项目，完整保留所有现有功能（节点、边、食物、翅膀、快速通道、NPC、导入导出），提升代码可维护性和可扩展性。

## 2. 技术栈

- **Vite 5** — 开发服务器 + 构建工具
- **Vue 3** (Composition API + `<script setup>`)
- **Pinia** — 全局状态管理
- **Phaser 3.60** — 画布渲染（保持不变）
- **纯 CSS** — 无 UI 框架，迁移现有样式

## 3. 项目结构

```
creator/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── styles/
│   │   └── main.css              # 从 editor.html 提取的全部样式
│   ├── stores/
│   │   └── editorStore.js        # Pinia store：level 数据、选中状态、工具状态
│   ├── composables/
│   │   ├── usePhaserCanvas.js    # Phaser 实例生命周期管理
│   │   └── useDragDrop.js        # 工具栏拖拽逻辑
│   ├── components/
│   │   ├── EditorToolbar.vue
│   │   ├── EditorCanvas.vue
│   │   ├── EditorPanel.vue
│   │   ├── NodeTab.vue
│   │   ├── EdgeTab.vue
│   │   ├── ItemTab.vue
│   │   ├── NpcTab.vue
│   │   ├── MetaTab.vue
│   │   ├── ToastNotification.vue
│   │   └── ImportModal.vue
│   └── data/
│       └── levelDefaults.js
```

## 4. 状态管理（Pinia Store）

```js
// editorStore.js
{
  // 关卡数据
  level: {
    id: 1,
    name: '',
    difficulty: '简单',
    startNode: -1,
    homeNode: -1,
    initialEnergy: 120,
    nodes: [],      // { id, x, y, isStart, isHome, isDead, label }
    edges: [],      // [nodeIdA, nodeIdB]
    food: [],       // { nodeId, type: 'leaf'|'berry'|'apple' }
    wings: [],      // { nodeId }
    fastTravel: [], // [nodeIdA, nodeIdB]
    npcs: []        // { id, type, edgeA, edgeB, sneakEnergyCost }
  },

  // UI 状态
  selectedId: null,
  activeTool: null,    // 'node'|'edge'|'fasttravel'|'npc'|'food'|'wing'
  connMode: {
    active: false,
    tool: null,
    fromId: null,
    cx: 0,
    cy: 0
  },
  activeTab: 'nodes',
  toast: { show: false, msg: '' }
}
```

所有原有的 `EditorLevel` 类方法迁移为 store actions：
- `addNode(x, y)` / `removeNode(id)` / `updateNode(id, f)`
- `addEdge(a, b)` / `removeEdge(a, b)`
- `addFood(nid, t)` / `removeFood(nid)` / `cycleFood(nid)`
- `addWing(nid)` / `removeWing(nid)` / `toggleWing(nid)`
- `addFT(a, b)` / `removeFT(a, b)`
- `addNPC(eA, eB)` / `removeNPC(id)` / `updateNPC(id, f)`
- `toJSON()` / `fromJSON(o)`
- `select(id)` — 更新 `selectedId`

## 5. 组件职责

| 组件 | 职责 |
|---|---|
| `App.vue` | 整体布局、初始化 Pinia store |
| `EditorToolbar.vue` | 工具栏按钮，点击设置 `activeTool`，拖拽触发 `useDragDrop` |
| `EditorCanvas.vue` | 挂载 Phaser、响应鼠标事件、调用 store actions |
| `EditorPanel.vue` | Tab 容器，切换 `activeTab` |
| `NodeTab.vue` | 节点列表 + 属性表单（坐标、标签、类型 checkbox） |
| `EdgeTab.vue` | 边列表 + 删除按钮 |
| `ItemTab.vue` | 食物/翅膀/快速通道三个子列表 |
| `NpcTab.vue` | NPC 卡片列表 + 属性编辑 |
| `MetaTab.vue` | 名称、难度、初始能量、起点/终点节点选择器 |
| `ToastNotification.vue` | 底部右侧 Toast 提示 |
| `ImportModal.vue` | JSON 导入弹窗 |

## 6. Composables

### usePhaserCanvas

```js
// 返回 { phaserReady }
// 内部：new Phaser.Game(...) 并在 store.level 变化时触发重绘
// watch(() => store.level, redraw, { deep: true })
```

### useDragDrop

处理工具栏按钮的 `mousedown` + 文档级 `mousemove` + `mouseup` 事件，逻辑与原 `td` / `GHOST` 全局变量等价。

## 7. Phaser 重绘逻辑

`redraw()` 函数从 store 读取 `level` 数据，绘制边、节点、食物、翅膀、NPC、选中高亮、连接橡皮筋。迁移自原 `editor.html` 的 `redraw()` 函数，保持视觉一致。

## 8. 样式迁移

- 所有原有 `<style>` 内容移至 `src/styles/main.css`
- 组件内用 `<style scoped>` 处理局部覆盖

## 9. 运行方式

```bash
cd creator
npm install
npm run dev
# 打开 http://localhost:5173
```

## 10. 完成标准

- 所有原有功能（节点增删改、边、NPC、食物、翅膀、快速通道、导入导出）完整保留
- Vue 3 响应式正常：操作后 UI 即时更新
- 删除旧的 `editor.html`
