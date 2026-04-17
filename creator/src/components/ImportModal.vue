<template>
  <div id="import-modal" class="show" @click.self="store.showImportModal = false">
    <div class="modal-box">
      <h3>导入 JSON</h3>
      <textarea v-model="importText" placeholder="粘贴 JSON 内容..."></textarea>
      <div class="modal-actions">
        <button class="btn" @click="store.showImportModal = false">取消</button>
        <button class="btn primary" @click="onConfirm">导入</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editorStore.js'

const store = useEditorStore()
const importText = ref('')

function onConfirm() {
  try {
    store.fromJSON(JSON.parse(importText.value.trim()))
    store.showImportModal = false
    store.showToast('✅ JSON 导入成功！')
  } catch (e) {
    store.showToast('❌ JSON 格式错误')
  }
}

function onKeydown(e) { if (e.key === 'Escape') store.showImportModal = false }
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>
