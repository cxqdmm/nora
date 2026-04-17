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
