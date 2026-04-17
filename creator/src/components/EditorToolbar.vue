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
