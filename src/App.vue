<template>
  <el-config-provider :locale="currentLocale">
    <div class="app-container">
      <div class="header">
        <div class="logo">AI Studio Dataset</div>
        <div class="header-right">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
      <div class="main-content">
        <ExplorerPanel />
        <MainContentDisplay />
      </div>
      <UploadProgressOverlay />
    </div>
  </el-config-provider>
</template>

<script setup>
import { onMounted, computed } from 'vue'; 
import ExplorerPanel from './components/ExplorerPanel.vue';
import MainContentDisplay from './components/MainContentDisplay.vue';
import UploadProgressOverlay from './components/UploadProgressOverlay.vue'; // Import the overlay
import { useDatasetStore } from './stores/datasetStore'; 
import { useUploadStore } from './stores/uploadStore'; // Import upload store for potential initialization if needed
import { useUIStore } from './stores/uiStore';
import { useI18n } from 'vue-i18n'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import en from 'element-plus/dist/locale/en.mjs'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'

// Initialize stores
const datasetStore = useDatasetStore();
const uploadStore = useUploadStore(); // Initialize upload store
const uiStore = useUIStore();

const { locale } = useI18n()

const currentLocale = computed(() => {
  return locale.value === 'zh-CN' ? zhCn : en
})

onMounted(async () => {
  // 初始化主题
  uiStore.initTheme();
  
  // Fetch initial global data
  // console.log('App.vue onMounted: Fetching initial constraints');
  await datasetStore.fetchDatasetConstraints();
  // Initial dataset load will be triggered by ExplorerPanel itself now

  // Example: Add a dummy task to test the overlay (remove in production)
  // uploadStore.addTask({ name: 'Initial Test Task.jpg', type: 'file' });
});
</script>

<style>
/* Reset default browser styles */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden; /* Prevent scrollbars on the body */
}

#app-container {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* text-align: center; */ /* Remove default center alignment */
  /* color: #2c3e50; */ /* Default color can be overridden by panels */
}

.vscode-layout {
  display: flex;
  height: 100vh; /* Full viewport height */
  width: 100vw; /* Full viewport width */
  background-color: #1e1e1e; /* VS Code like background for the whole app */
}

.sidebar {
  width: 300px;
  background-color: #252526; /* Dark sidebar background (VS Code 'Activity Bar'/'Explorer' area) */
  color: #cccccc; /* Light text for sidebar */
  /* padding: 10px; */ /* Padding will be handled by ExplorerPanel or specific content */
  border-right: 1px solid #333333; /* Separator line, slightly lighter than pure black */
  height: 100%; /* Ensure sidebar also takes full height */
  box-sizing: border-box; /* Include padding and border in the element's total width and height */
  display: flex; /* To allow ExplorerPanel to fill it */
  flex-direction: column; /* Stack items vertically if multiple things go in sidebar */
}

.main-content {
  flex-grow: 1; /* Takes up remaining space */
  padding: 20px; /* Padding for content inside the main area */
  background-color: #1e1e1e; /* Dark editor background (VS Code editor area) */
  color: #d4d4d4; /* Light text for main content */
  height: 100%; /* Ensure main content also takes full height */
  box-sizing: border-box;
  text-align: left; /* Align text to the left for typical content */
  overflow-y: auto; /* Allow scrolling if content exceeds height */
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.logo {
  font-size: 20px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  background-color: var(--el-bg-color);
}

/* 主题相关样式 */
:root[data-theme="dark"] {
  --el-bg-color: #1e1e1e;
  --el-bg-color-overlay: #2c2c2d;
  --el-text-color-primary: #e0e0e0;
  --el-text-color-regular: #cccccc;
  --el-border-color-light: #333333;
  --el-fill-color-light: #2c2c2d;
}

:root[data-theme="light"] {
  --el-bg-color: #ffffff;
  --el-bg-color-overlay: #ffffff;
  --el-text-color-primary: #303133;
  --el-text-color-regular: #606266;
  --el-border-color-light: #e4e7ed;
  --el-fill-color-light: #f5f7fa;
}
</style>
