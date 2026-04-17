<template>
  <div class="tab-content active">
    <div class="section-title">所有边（拖入画布创建）</div>
    <div class="edge-list">
      <div v-if="!store.level.edges.length" style="color:#555;font-size:12px">无边</div>
      <div v-for="([a, b]) in store.level.edges" :key="`${a}-${b}`" class="list-item">
        <span>{{ a }} ↔ {{ b }}</span>
        <span class="del" @click="store.removeEdge(a, b)">✕</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
const store = useEditorStore()
</script>
