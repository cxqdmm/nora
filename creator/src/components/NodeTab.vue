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
