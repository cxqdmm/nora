<template>
  <div id="toast" :class="{ show: store.toast.show }">{{ store.toast.msg }}</div>
</template>

<script setup>
import { useEditorStore } from '../stores/editorStore.js'
const store = useEditorStore()
</script>
