import { defineStore } from 'pinia';

export const useUIStore = defineStore('ui', {
  state: () => ({
    /**
     * Holds information about the item selected in the ExplorerPanel.
     * Structure can vary based on item type.
     * Examples:
     * For a dataset: { type: 'dataset', id: 'datasetId', label: 'Dataset Name', ...otherDatasetProps }
     * For a file in a dataset: { type: 'file', id: 'fileId', label: 'File Name', datasetId: 'parentDatasetId', ...otherFileProps }
     * For a folder in a dataset: { type: 'folder', id: 'folderNodeId', label: 'Folder Name', datasetId: 'parentDatasetId', ...otherFolderProps }
     * For a server file/folder (if needed): { type: 'server-file', path: '/path/to/server/file', name: 'server_file.txt' }
     */
    selectedExplorerItem: null,
    // Potentially other UI states like dialog visibility could go here,
    // but for now, dialogs manage their own visibility.
    // isLoadingGlobally: false, // Example for a global loading spinner
  }),
  actions: {
    /**
     * Sets the currently selected item in the explorer.
     * @param {object | null} itemData - The data of the selected item, or null to clear selection.
     */
    selectExplorerItem(itemData) {
      // console.log('UIStore: Selecting item', itemData); // For debugging
      this.selectedExplorerItem = itemData;
    },

    clearSelectedExplorerItem() {
      this.selectedExplorerItem = null;
    },

    // Example of how other UI states could be managed
    // setGlobalLoading(isLoading) {
    //   this.isLoadingGlobally = isLoading;
    // }
  },
  getters: {
    // Getter to easily check if an item is selected
    isExplorerItemSelected: (state) => {
      return !!state.selectedExplorerItem;
    },
    // Getter to get specific details if needed, e.g. selected item type
    selectedItemType: (state) => {
        return state.selectedExplorerItem?.type || null;
    }
  }
});
