<template>
  <div id="app-container" class="vscode-layout">
    <div class="sidebar">
      <ExplorerPanel />
    </div>
    <div class="main-content">
      <MainContentDisplay />
    </div>
    <UploadProgressOverlay /> {/* Add the overlay component here */}
  </div>
</template>

<script setup>
import { onMounted } from 'vue'; 
import ExplorerPanel from './components/ExplorerPanel.vue';
import MainContentDisplay from './components/MainContentDisplay.vue';
import UploadProgressOverlay from './components/UploadProgressOverlay.vue'; // Import the overlay
import { useDatasetStore } from './stores/datasetStore'; 
import { useUploadStore } from './stores/uploadStore'; // Import upload store for potential initialization if needed

// Initialize stores
const datasetStore = useDatasetStore();
const uploadStore = useUploadStore(); // Initialize upload store

onMounted(async () => {
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
</style>
