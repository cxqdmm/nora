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
watch(() => store.selectedId, (id) => {
  if (id !== null) {
    const n = store.getNode(id)
    if (n) coordBarText.value = `x:${Math.round(n.x)}  y:${Math.round(n.y)}`
  } else {
    coordBarText.value = '就绪'
  }
  if (phaserReady.value) redraw()
})
watch(() => store.connMode, () => { if (phaserReady.value) redraw() }, { deep: true })

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
