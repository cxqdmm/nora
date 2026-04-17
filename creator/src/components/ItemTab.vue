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
