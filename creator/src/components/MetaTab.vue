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
