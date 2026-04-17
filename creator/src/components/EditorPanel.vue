<template>
  <div id="panel">
    <div class="tabs">
      <div v-for="tab in tabs" :key="tab.key" class="tab" :class="{ active: store.activeTab === tab.key }" @click="store.activeTab = tab.key">
        {{ tab.label }}
      </div>
    </div>
    <NodeTab v-if="store.activeTab === 'nodes'" />
    <EdgeTab v-if="store.activeTab === 'edges'" />
    <ItemTab v-if="store.activeTab === 'items'" />
    <NpcTab v-if="store.activeTab === 'npcs'" />
    <MetaTab v-if="store.activeTab === 'meta'" />
  </div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
import NodeTab from './NodeTab.vue'
import EdgeTab from './EdgeTab.vue'
import ItemTab from './ItemTab.vue'
import NpcTab from './NpcTab.vue'
import MetaTab from './MetaTab.vue'

const store = useEditorStore()
const tabs = [
  { key: 'nodes', label: '节点' },
  { key: 'edges', label: '边' },
  { key: 'items', label: '道具' },
  { key: 'npcs', label: 'NPC' },
  { key: 'meta', label: '基础' }
]
</script>
