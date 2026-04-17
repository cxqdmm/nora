import { ref, onMounted, onUnmounted } from 'vue'
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

  onMounted(() => {
    document.addEventListener('mousemove', onMousemove)
    document.addEventListener('mouseup', onMouseup)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMousemove)
    document.removeEventListener('mouseup', onMouseup)
  })

  return { dragging, onToolbarMousedown }
}
