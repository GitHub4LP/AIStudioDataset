<template>
  <div class="app-container">
    <h1>文件选择器</h1>
    <file-selector />
    <dataset-list />
  </div>
</template>

<script setup>
import FileSelector from './components/FileSelector.vue'
import DatasetList from './components/DatasetList.vue'
</script>

<style>
.app-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #409EFF;
  margin-bottom: 30px;
}
</style> 