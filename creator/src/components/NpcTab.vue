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
