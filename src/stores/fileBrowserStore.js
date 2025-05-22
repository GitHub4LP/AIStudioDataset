import { defineStore } from 'pinia';
import { getServerFiles as apiGetServerFiles } from '@/services/apiService';

export const useFileBrowserStore = defineStore('fileBrowser', {
  state: () => ({
    // State for a specific browser instance, identified by a key (e.g., 'explorer', 'addFileDialog')
    // This allows multiple independent file browsers if needed.
    // For now, let's assume one primary browser context or manage context outside.
    // If used in multiple places simultaneously with different states, this structure needs adjustment.
    
    // For a single, primary server file browser (e.g., in ExplorerPanel)
    currentPath: '.',
    serverFiles: [],
    isLoading: false,
    error: null,
    
    // Configuration for base paths - might be static or fetched
    basePaths: [
      { label: '项目根目录', value: '.' },
      { label: '上传目录', value: 'uploads' },
      { label: '下载目录', value: 'downloads' }
    ],
    selectedBasePath: '.', // Tracks the selected base path from the dropdown
  }),
  actions: {
    async fetchFiles(path) {
      this.isLoading = true;
      this.error = null;
      try {
        const data = await apiGetServerFiles(path);
        this.serverFiles = data.files.map(file => ({
          ...file,
          // Ensure each file object has a full path for easier use later
          path: data.currentPath === '.' ? file.name : `${data.currentPath}/${file.name}`
        }));
        this.currentPath = data.currentPath;
        // If the fetched path is one of the base paths, update selectedBasePath
        const matchingBasePath = this.basePaths.find(bp => bp.value === data.currentPath);
        if (matchingBasePath) {
            this.selectedBasePath = matchingBasePath.value;
        } else {
            // If navigating into a subfolder, try to determine the base path
            // This logic might need refinement based on how paths are constructed
            const pathParts = data.currentPath.split('/');
            if (pathParts.length > 0) {
                const topLevelDir = pathParts[0];
                const foundBasePath = this.basePaths.find(bp => bp.value === topLevelDir);
                if (foundBasePath) {
                    this.selectedBasePath = foundBasePath.value;
                } else if (data.currentPath === '.') { // Handle root explicitly
                    this.selectedBasePath = '.';
                }
                // else, selectedBasePath remains as is, or could be set to a "custom" state
            }
        }

      } catch (err) {
        console.error(`Failed to fetch files for path ${path}:`, err);
        this.error = err.message;
        this.serverFiles = []; // Clear files on error
      } finally {
        this.isLoading = false;
      }
    },

    // Action to handle base path changes from the dropdown
    async changeBasePath(newBasePathValue) {
        this.selectedBasePath = newBasePathValue;
        // Fetch files for the new base path
        await this.fetchFiles(newBasePathValue);
    },

    // Action to navigate to a subfolder or specific path segment
    async navigateToPath(fullPath) {
        // This action assumes fullPath is correctly constructed by the component
        // (e.g., from breadcrumbs or clicking a folder)
        await this.fetchFiles(fullPath);
    }
  },
  getters: {
    // Path segments for breadcrumbs, derived from currentPath
    pathSegments: (state) => {
      if (typeof state.currentPath !== 'string') return [state.selectedBasePath];
      
      const segments = state.currentPath.split('/');
      if (segments.length === 0 || (segments.length === 1 && segments[0] === '')) {
        const basePath = state.basePaths.find(bp => bp.value === state.selectedBasePath);
        return [basePath ? basePath.label : state.selectedBasePath];
      }

      // If currentPath is a base path alias, display its label
      if (segments.length === 1 && state.basePaths.some(bp => bp.value === segments[0])) {
         const basePathLabel = state.basePaths.find(bp => bp.value === segments[0])?.label;
         return basePathLabel ? [basePathLabel] : [segments[0]];
      }
      
      // Otherwise, construct segments, replacing '.' with the base path label
      return segments.map(segment => {
        if (segment === '.') {
            const basePath = state.basePaths.find(bp => bp.value === state.selectedBasePath);
            return basePath ? basePath.label : '根目录';
        }
        return segment;
      });
    }
  }
});
