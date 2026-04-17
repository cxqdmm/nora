<template>
  <div id="app-root">
    <EditorToolbar />
    <div id="main">
      <EditorCanvas />
      <EditorPanel />
    </div>
    <ToastNotification />
    <ImportModal v-if="store.showImportModal" />
    <div id="ghost"></div>
  </div>
</template>

<script setup>
import { useEditorStore } from './stores/editorStore.js'
import EditorToolbar from './components/EditorToolbar.vue'
import EditorCanvas from './components/EditorCanvas.vue'
import EditorPanel from './components/EditorPanel.vue'
import ToastNotification from './components/ToastNotification.vue'
import ImportModal from './components/ImportModal.vue'

const store = useEditorStore()
</script>

<style>
#app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a2e;
  font-family: 'Microsoft YaHei', sans-serif;
  color: #e0e0e0;
  overflow: hidden;
}
</style>
