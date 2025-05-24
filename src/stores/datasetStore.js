import { defineStore } from 'pinia';
import { 
    fetchPrivateDatasetList, 
    getDatasetDetails, 
    updateDataset as apiUpdateDataset, 
    deleteDataset as apiDeleteDataset,
    getDatasetConstraints as apiGetDatasetConstraints,
    registerServerFile as apiRegisterServerFile, // For adding files
    createDataset, // <-- 确保导入
    removeFileFromDataset, // <-- 确保导入
    getFileDownloadUrl // <-- 添加导入
} from '@/services/apiService'; // Assuming @ is configured for src
import { buildFileTree } from '../utils/fileTreeHelper';

const PAGE_SIZE = 20; // As used in ExplorerPanel
const MAX_CONCURRENT_REQUESTS = 3; // As used in ExplorerPanel

export const useDatasetStore = defineStore('dataset', {
  state: () => ({
    datasets: [], // Holds the brief list from private list endpoint
    detailedDatasets: {}, // Cache for full dataset details { [datasetId]: details }
    // selectedDataset: null, // Replaced by detailedDatasets[id] or a getter
    datasetConstraints: null,
    isLoadingDatasets: false,
    isLoadingDetails: false, // For individual dataset loading
    datasetError: null,
    // For progress tracking during initial load
    totalPages: 0,
    loadedPages: 0,
  }),
  getters: {
    getDatasetById: (state) => (id) => {
      return state.detailedDatasets[id] || state.datasets.find(ds => ds.datasetId === id);
    },
    // Getter to build tree-like structure for ExplorerPanel if needed,
    // or this logic can remain in ExplorerPanel and use detailedDatasets.
    // For simplicity, ExplorerPanel can adapt to use detailedDatasets.
  },
  actions: {
    async fetchDatasetConstraints() {
      if (this.datasetConstraints) return; // Already fetched
      try {
        const constraints = await apiGetDatasetConstraints();
        this.datasetConstraints = constraints;
      } catch (error) {
        console.error('Failed to fetch dataset constraints:', error);
        // Handle error appropriately, maybe set an error state
      }
    },

    async fetchDatasets() {
      this.isLoadingDatasets = true;
      this.datasetError = null;
      this.totalPages = 0;
      this.loadedPages = 0;
      this.datasets = [];
      this.detailedDatasets = {};

      try {
        const firstPageResponse = await fetchPrivateDatasetList(1, PAGE_SIZE);
        if (!firstPageResponse || !firstPageResponse.result) {
          throw new Error('Initial dataset fetch: Data format incorrect');
        }
        
        this.totalPages = firstPageResponse.result.totalPage;
        let allDatasetMetas = [...firstPageResponse.result.data];
        this.loadedPages = 1;

        if (this.totalPages > 1) {
          const remainingPages = Array.from({ length: this.totalPages - 1 }, (_, i) => i + 2);
          for (let i = 0; i < remainingPages.length; i += MAX_CONCURRENT_REQUESTS) {
            const batch = remainingPages.slice(i, i + MAX_CONCURRENT_REQUESTS);
            const results = await Promise.all(batch.map(page => fetchPrivateDatasetList(page, PAGE_SIZE)));
            results.forEach(pageData => {
              if (pageData && pageData.result && pageData.result.data) {
                allDatasetMetas = [...allDatasetMetas, ...pageData.result.data];
              }
            });
            this.loadedPages += batch.length;
          }
        }
        this.datasets = allDatasetMetas;

        // Now fetch details for all datasets concurrently
        // This might be too much for many datasets, consider fetching details on demand (e.g., when selected)
        // For now, matching existing behavior from ExplorerPanel
        const detailPromises = allDatasetMetas.map(ds => 
            getDatasetDetails(ds.datasetId)
                .then(detailData => {
                    if (detailData && detailData.result) {
                        this.detailedDatasets[ds.datasetId] = { 
                            ...ds, // Add basic info from list
                            ...detailData.result, // Add details
                            // Ensure essential fields are present
                            id: ds.datasetId,
                            label: ds.datasetName,
                            description: detailData.result.datasetAbs || ds.datasetAbs,
                            tags: detailData.result.tags || ds.tags || [],
                            fileIds: detailData.result.fileList?.map(f => f.fileId) || [],
                            fileAbsList: detailData.result.fileList?.map(f => f.fileAbs) || [],
                            flatFileList: detailData.result.fileList || [],
                            children: buildFileTree(detailData.result.fileList || [], ds.datasetId),
                            ispublic: detailData.result.public !== undefined ? detailData.result.public : (ds.public !== undefined ? ds.public : 0),

                        };
                    }
                })
                .catch(e => console.error(`Error fetching detail for ${ds.datasetId}:`, e))
        );
        await Promise.all(detailPromises);

      } catch (error) {
        console.error('Failed to fetch datasets:', error);
        this.datasetError = error.message;
      } finally {
        this.isLoadingDatasets = false;
      }
    },

    async fetchDatasetDetails(datasetId, force = false) {
      if (!datasetId) return null;
      if (!force && this.detailedDatasets[datasetId]) {
        return this.detailedDatasets[datasetId];
      }
      this.isLoadingDetails = true;
      try {
        const detailData = await getDatasetDetails(datasetId);
        if (detailData && detailData.result) {
          const listVersion = this.datasets.find(d => d.datasetId === datasetId) || {};
          this.detailedDatasets[datasetId] = {
            ...listVersion,
            ...detailData.result,
            id: datasetId, // Ensure ID is consistent
            label: detailData.result.datasetName || listVersion.datasetName,
            description: detailData.result.datasetAbs || listVersion.datasetAbs,
            tags: detailData.result.tags || listVersion.tags || [],
            fileIds: detailData.result.fileList?.map(f => f.fileId) || [],
            fileAbsList: detailData.result.fileList?.map(f => f.fileAbs) || [],
            flatFileList: detailData.result.fileList || [],
            children: buildFileTree(detailData.result.fileList || [], datasetId),
            ispublic: detailData.result.public !== undefined ? detailData.result.public : (listVersion.public !== undefined ? listVersion.public : 0),

          };
          return this.detailedDatasets[datasetId];
        }
      } catch (error) {
        console.error(`Failed to fetch details for dataset ${datasetId}:`, error);
        this.datasetError = error.message; // Or a specific error for this action
      } finally {
        this.isLoadingDetails = false;
      }
      return null;
    },
    
    async updateDataset({ datasetId, datasetName, datasetAbs, tags, fileIds, fileAbsList, ispublic }) {
      this.isLoadingDetails = true; // Indicate loading for the specific dataset
      try {
        const updatedDataset = await apiUpdateDataset(datasetId, {
          datasetName,
          datasetAbs,
          tags,
          fileIds,
          fileAbsList,
          ispublic
        });
        // Refresh the specific dataset's details and the main list
        await this.fetchDatasetDetails(datasetId, true); // Force refresh
        // Optionally, find and update in the 'datasets' list if structure is simple
        const index = this.datasets.findIndex(ds => ds.datasetId === datasetId);
        if (index !== -1) {
            this.datasets[index] = { ...this.datasets[index], ...this.detailedDatasets[datasetId] };
        }
        return updatedDataset; // Or the refreshed one from detailedDatasets
      } catch (error) {
        console.error(`Failed to update dataset ${datasetId}:`, error);
        this.datasetError = error.message;
        throw error; // Re-throw for component to handle
      } finally {
        this.isLoadingDetails = false;
      }
    },

    async deleteDataset(datasetId) {
      this.isLoadingDatasets = true; // Could be a global loading or specific item loading
      try {
        await apiDeleteDataset(datasetId);
        this.datasets = this.datasets.filter(ds => ds.datasetId !== datasetId);
        delete this.detailedDatasets[datasetId];
        // If this was the selected dataset, uiStore should handle clearing it
      } catch (error) {
        console.error(`Failed to delete dataset ${datasetId}:`, error);
        this.datasetError = error.message;
        throw error;
      } finally {
        this.isLoadingDatasets = false;
      }
    },

    // Action for adding files, used by AddFilesDialog
    // It assumes file processing (like registerServerFile) is done IN THE DIALOG
    // and this action just handles the final dataset update.
    async addFilesToDataset({ datasetId, newFilesData, existingDatasetData }) {
        // newFilesData = array of { fileId, fileAbs }
        // existingDatasetData = { datasetName, datasetAbs, tags, ispublic, fileIds, fileAbsList }
        this.isLoadingDetails = true;
        try {
            const combinedFileIds = [...existingDatasetData.fileIds, ...newFilesData.map(f => f.fileId)];
            const combinedFileAbsList = [...existingDatasetData.fileAbsList, ...newFilesData.map(f => f.fileAbs)];

            const payload = {
                datasetName: existingDatasetData.datasetName,
                datasetAbs: existingDatasetData.datasetAbs,
                tags: existingDatasetData.tags,
                ispublic: existingDatasetData.ispublic,
                fileIds: combinedFileIds,
                fileAbsList: combinedFileAbsList,
            };
            await apiUpdateDataset(datasetId, payload);
            await this.fetchDatasetDetails(datasetId, true); // Force refresh
             const index = this.datasets.findIndex(ds => ds.datasetId === datasetId);
            if (index !== -1) {
                 this.datasets[index] = { ...this.datasets[index], ...this.detailedDatasets[datasetId] };
            }
        } catch (error) {
            console.error(`Failed to add files to dataset ${datasetId}:`, error);
            this.datasetError = error.message;
            throw error;
        } finally {
            this.isLoadingDetails = false;
        }
    },
    
    // Action for removing a file, used by MainContentDisplay
    async removeFileFromDataset({ datasetId, fileIdToRemove }) {
        this.isLoadingDetails = true;
        try {
            const dataset = this.detailedDatasets[datasetId];
            if (!dataset) throw new Error("Dataset details not found for removal.");

            // 调用新的RESTful API删除文件
            await removeFileFromDataset(datasetId, fileIdToRemove);
            
            // 刷新数据集详情
            await this.fetchDatasetDetails(datasetId, true);
            
            // 更新数据集列表中的对应项
            const index = this.datasets.findIndex(ds => ds.datasetId === datasetId);
            if (index !== -1) {
                this.datasets[index] = { ...this.datasets[index], ...this.detailedDatasets[datasetId] };
            }
        } catch (error) {
            console.error(`Failed to remove file from dataset ${datasetId}:`, error);
            this.datasetError = error.message;
            throw error;
        } finally {
            this.isLoadingDetails = false;
        }
    },

    async createNewDataset(datasetDetails, filesList) {
      // datasetDetails: { name, abs, tags }
      // filesList: array of { fileId, fileAbs, name? }
      this.isLoadingDatasets = true; // Indicate global dataset list might change
      this.datasetError = null;
      try {
        const payload = {
          datasetName: datasetDetails.name,
          datasetAbs: datasetDetails.abs,
          tags: datasetDetails.tags,
          fileIds: filesList.map(f => f.fileId),
          fileAbsList: filesList.map(f => f.fileAbs),
          // ispublic is not part of datasetDetails form, default to 0 (private)
          // If it needs to be configurable, add to datasetDetails form
        };
        
        // console.log("Creating new dataset with payload:", payload);
        const newDatasetResponse = await createDataset(payload); // apiService.createDataset

        if (!newDatasetResponse || !newDatasetResponse.success || !newDatasetResponse.datasetId) {
          throw new Error(newDatasetResponse.error || '创建数据集未能返回有效的ID。');
        }
        
        // After successful creation, refresh the entire dataset list
        // This will also update detailedDatasets if fetchDatasets is comprehensive
        await this.fetchDatasets(); 
        
        // Optionally, return the new dataset's ID or details if needed by the component
        return newDatasetResponse.result; // Or newDatasetResponse.datasetId

      } catch (error) {
        console.error('Failed to create new dataset:', error);
        this.datasetError = error.message;
        throw error; // Re-throw for component to handle
      } finally {
        this.isLoadingDatasets = false;
      }
    },

    async getBosUrl(datasetId, fileId) {
      if (!datasetId || !fileId) {
        console.error('getBosUrl: datasetId and fileId are required.');
        throw new Error('Dataset ID and File ID are required.');
      }
      try {
        // The apiService.getFileDownloadUrl already calls the correct backend endpoint
        // that returns the BOS URL as plain text.
        const url = await getFileDownloadUrl({ datasetId, fileId });
        if (!url) {
          throw new Error('Received empty URL from backend.');
        }
        return url;
      } catch (error) {
        console.error(`Failed to get BOS URL for dataset ${datasetId}, file ${fileId}:`, error);
        throw error; // Re-throw for the component to handle
      }
    },

    async downloadFile(fileId) {
      if (!fileId) {
        throw new Error('File ID is required for download.');
      }
      
      try {
        // 获取文件所属的数据集ID
        let datasetId = null;
        for (const [dsId, dataset] of Object.entries(this.detailedDatasets)) {
          const file = dataset.flatFileList?.find(f => f.fileId === fileId);
          if (file) {
            datasetId = dsId;
            break;
          }
        }
        
        if (!datasetId) {
          throw new Error('Could not find dataset for the file.');
        }

        // 获取下载URL
        const downloadUrl = await this.getBosUrl(datasetId, fileId);
        
        // 创建一个隐藏的a标签来触发下载
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.style.display = 'none';
        link.setAttribute('download', ''); // 强制下载而不是打开
        link.setAttribute('rel', 'noreferrer'); // 添加noreferer
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return { success: true };
      } catch (error) {
        console.error(`Failed to download file ${fileId}:`, error);
        throw error;
      }
    }
  }
});
