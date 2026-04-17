import { ref } from 'vue'
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

  function destroyPhaser() {
    if (game) { game.destroy(true); game = null; scene = null; phaserReady.value = false }
  }

  return { phaserReady, redraw, initPhaser, destroyPhaser }
}
