<template>
  <div class="explorer-panel-container">
    <div class="explorer-panel" @click="closeContextMenu">
      <el-collapse v-model="activeCollapseNames">
        <el-collapse-item name="datasets" :title="t('dataset.name')">
          <el-button
            type="primary"
            link
            size="small"
            @click.stop="handleOpenCreateEmptyDatasetDialog"
            class="collapse-header-action-btn"
            :title="t('dataset.createEmpty')"
          >
            <el-icon><Plus /></el-icon> {{ t('dataset.createEmpty') }}
          </el-button>
          <div v-if="datasetStore.isLoadingDatasets && Object.keys(datasetStore.detailedDatasets).length === 0" class="dataset-loading-indicator">
            <el-skeleton :rows="3" animated />
            <div class="progress-text">{{ t('common.loading') }} {{ datasetStore.loadedPages }}/{{ datasetStore.totalPages }} {{ t('common.page') }}</div>
          </div>
          <div v-else-if="datasetStore.datasetError" class="dataset-error-message">
            {{ t('error.loadDatasetFailed') }}: {{ datasetStore.datasetError }}
          </div>
          <el-tree
            v-else
            :data="builtDatasetTreeData"
            :props="datasetTreeProps"
            node-key="id"
            highlight-current
            class="dataset-tree"
            :empty-text="t('dataset.empty')"
            @node-click="handleDatasetTreeNodeClick"
            @node-contextmenu="handleNodeContextMenu"
            :draggable="false" 
            @node-drop="handleNodeDrop"
            @dragover.prevent
            @dragenter.prevent
          >
            <template #default="{ node, data }">
              <span class="tree-node-custom">
                <span class="node-label" :title="getNodeTitle(data)">
                  <span v-if="data.type === 'dataset'" class="dataset-icon-wrapper">
                    <el-icon><Coin /></el-icon>
                  </span>
                  <span v-else-if="data.type === 'folder'" class="folder-icon-wrapper">
                    <el-icon><FolderOpened v-if="node.expanded" /><Folder v-else /></el-icon>
                  </span>
                  <span v-else-if="data.type === 'file'" class="file-icon-wrapper" :style="{ color: getFileIconColor(data.label, data.fileContentType) }">
                    <svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align: middle;">
                      <path fill="currentColor" :d="getFileIconPath(data.label, data.fileContentType)"/>
                    </svg>
                  </span>
                  <span class="node-text">{{ node.label }}</span>
                </span>
                <span v-if="data.type === 'dataset'" class="node-actions">
                  <el-button
                    link
                    type="danger"
                    size="small"
                    @click="confirmDeleteDataset(data)"
                    title="删除数据集"
                    class="delete-dataset-btn"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </span>
                <span v-else-if="data.type === 'file'" class="file-meta-info">
                   {{ formatFileSize(data.fileSize) }}
                </span>
              </span>
            </template>
          </el-tree>
        </el-collapse-item>
      </el-collapse>

      <!-- Custom Context Menu -->
      <div
        v-if="contextMenuVisible"
        class="custom-context-menu"
        :style="{ top: contextMenuPosition.top, left: contextMenuPosition.left }"
      >
        <ul>
          <li v-if="contextMenuTargetNode && (contextMenuTargetNode.type === 'dataset' || contextMenuTargetNode.type === 'folder')" 
              @click="triggerUploadLocalToNode">
            <el-icon><Upload /></el-icon> {{ t('file.uploadLocalFiles') }}
          </li>
          <li v-if="contextMenuTargetNode && (contextMenuTargetNode.type === 'dataset' || contextMenuTargetNode.type === 'folder')" 
              @click="triggerAddServerItemsToNode">
            <el-icon><FolderAdd /></el-icon> {{ t('file.addServerItems') }}
          </li>
          <li v-if="contextMenuTargetNode && (contextMenuTargetNode.type === 'dataset' || contextMenuTargetNode.type === 'folder')" 
              @click="triggerAddUrlToNode">
            <el-icon><LinkIcon /></el-icon> {{ t('file.addUrlFile') }}
          </li>
        </ul>
      </div>
    </div>
    <CreateDatasetDialog
      :visible="createDatasetDialogVisible"
      :files-for-dataset="processedFilesForDialog"
      @update:visible="createDatasetDialogVisible = $event"
      @dataset-created="handleDatasetCreatedWithFiles"
    />
    <CreateEmptyDatasetDialog
      :visible="createEmptyDatasetDialogVisible"
      @update:visible="createEmptyDatasetDialogVisible = $event"
      @dataset-created="handleEmptyDatasetCreated"
    />
    <UploadLocalFilesDialog
      :visible="uploadLocalFilesDialogVisible"
      :dataset-id="targetDatasetIdForUpload"
      :dataset-name="targetDatasetNameForUpload"
      :base-path-in-dataset="targetBasePathInDataset"
      :initial-files="droppedFilesForDialog"
      @update:visible="uploadLocalFilesDialogVisible = $event"
      @files-added="handleLocalFilesUploaded"
      @initial-files-processed="clearDroppedFiles"
    />
    <AddFilesDialog
      :visible="addServerItemsDialogVisible"
      :dataset-id="targetDatasetIdForUpload"
      :dataset-name="targetDatasetNameForUpload"
      :base-path-in-dataset="targetBasePathInDataset"
      @update:visible="addServerItemsDialogVisible = $event"
      @items-added="handleServerItemsAdded"
    />
    <AddUrlDialog
      :visible="addUrlDialogVisible"
      :dataset-id="targetDatasetIdForUpload"
      :dataset-name="targetDatasetNameForUpload"
      :base-path-in-dataset="targetBasePathInDataset"
      @update:visible="addUrlDialogVisible = $event"
      @file-added="handleAddUrlFileAdded"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { 
    ElCollapse, ElCollapseItem, ElTabs, ElTabPane, ElSelect, ElOption, 
    ElBreadcrumb, ElBreadcrumbItem, ElTable, ElTableColumn, ElIcon, 
    ElEmpty, ElSkeleton, ElTree, ElButton, ElMessage, ElMessageBox, ElUpload,
    ElForm, ElFormItem, ElInput 
} from 'element-plus';
import { Folder, Document, Delete, Coin, FolderOpened, UploadFilled, Plus, Upload, FolderAdd, Link as LinkIcon } from '@element-plus/icons-vue';
import CreateDatasetDialog from './CreateDatasetDialog.vue'; 
import CreateEmptyDatasetDialog from './CreateEmptyDatasetDialog.vue';
import UploadLocalFilesDialog from './UploadLocalFilesDialog.vue'; 
import AddFilesDialog from './AddFilesDialog.vue'; 
import AddUrlDialog from './AddUrlDialog.vue';
import * as apiService from '@/services/apiService'; 
import { getFileIconPath, getFileIconColor, formatFileSize } from '@/utils/fileDisplayUtils'; 
import { useDatasetStore } from '@/stores/datasetStore';
import { useUIStore } from '@/stores/uiStore';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useI18n } from 'vue-i18n'

const datasetStore = useDatasetStore();
const uiStore = useUIStore();
const fileBrowserStore = useFileBrowserStore();
const { t } = useI18n()

const activeCollapseNames = ref(['datasets']);
const datasetTreeProps = { label: 'label', children: 'children', isLeaf: 'isFileNode' }; 
const droppedFilesForDialog = ref([]);

// --- State for New Empty Dataset Creation ---
const createEmptyDatasetDialogVisible = ref(false);

// --- State for Target Operations (Context Menu Triggered) ---
const targetDatasetIdForUpload = ref('');
const targetDatasetNameForUpload = ref('');
const targetBasePathInDataset = ref('');    

// --- State for Uploading Local Files Dialog ---
const uploadLocalFilesDialogVisible = ref(false);

// --- State for Adding Server Items Dialog ---
const addServerItemsDialogVisible = ref(false);

// --- State for Adding URL Dialog ---
const addUrlDialogVisible = ref(false);


// --- Context Menu State ---
const contextMenuVisible = ref(false);
const contextMenuPosition = reactive({ top: '0px', left: '0px' });
const contextMenuTargetNode = ref(null);


// --- Dataset Section Logic ---
const builtDatasetTreeData = computed(() => {
  return Object.values(datasetStore.detailedDatasets).map(ds => ({
    id: ds.id, 
    label: ds.label, 
    type: 'dataset', 
    isDataset: true, 
    description: ds.description, 
    tags: ds.tags,
    fileIds: ds.fileIds, 
    fileAbsList: ds.fileAbsList, 
    ispublic: ds.ispublic,
    children: Array.isArray(ds.children) 
      ? ds.children.map(node => transformFileNode(node, ds.id)).filter(Boolean) 
      : [],
  }));
});

function transformFileNode(node, datasetId) {
  if (!node) return null;
  const transformed = {
    ...node, 
    id: node.id, 
    label: node.label, 
    type: node.type, 
    datasetId: datasetId, 
    isFileNode: node.type === 'file', 
    // Ensure file-specific properties for icons are at the top level of the node
    fileName: node.fileName || node.label, // buildFileTree uses node.label for files from file.fileName
    fileContentType: node.fileContentType, // from original file object
    fileSize: node.fileSize, // from original file object
  };
  if (node.children && Array.isArray(node.children)) {
    transformed.children = node.children.map(child => transformFileNode(child, datasetId)).filter(Boolean);
  } else {
    transformed.children = []; 
  }
  return transformed;
}

const handleDatasetTreeNodeClick = async (data) => {
  closeContextMenu(); 
  uiStore.selectExplorerItem(data); 
};

const confirmDeleteDataset = async (datasetNodeData) => {
  closeContextMenu();
  if (!datasetNodeData || !datasetNodeData.id) {
    ElMessage.error(t('error.operationFailed'));
    return;
  }
  try {
    await ElMessageBox.confirm(
      t('file.deleteDatasetConfirm', { name: datasetNodeData.label }),
      t('file.deleteDatasetTitle'),
      { 
        confirmButtonText: t('file.confirmDelete'), 
        cancelButtonText: t('file.cancelDelete'), 
        type: 'warning', 
        customClass: 'dark-message-box' 
      }
    );
    await datasetStore.deleteDataset(datasetNodeData.id);
    ElMessage.success(t('file.deleteSuccess', { name: datasetNodeData.label }));
    if (uiStore.selectedExplorerItem?.id === datasetNodeData.id) {
      uiStore.clearSelectedExplorerItem();
    }
  } catch (error) {
    if (error !== 'cancel' && error.message !== 'cancel' && error.name !== 'cancel') {
      console.error('Delete dataset failed:', error);
      ElMessage.error(t('file.deleteFailed', { error: error.message || t('error.operationFailed') }));
    }
  }
};

const getNodeTitle = (data) => {
  if (!data) return '';
  if (data.type === 'dataset') {
    return `数据集: ${data.label}\nID: ${data.id}\n描述: ${data.description || '无'}`;
  } else if (data.type === 'folder') {
    return `文件夹: ${data.label}\n路径: ${data.path}`;
  } else if (data.type === 'file') {
    // Add File ID to tooltip
    return `文件: ${data.label}\nID: ${data.id}\n路径: ${data.path}\n大小: ${formatFileSize(data.fileSize) || '未知'}`;
  }
  return data.label || '';
};

// --- Context Menu Logic ---
const handleNodeContextMenu = (event, nodeData) => {
  event.preventDefault();
  if (nodeData.type === 'dataset' || nodeData.type === 'folder') {
    contextMenuTargetNode.value = nodeData;
    contextMenuPosition.left = `${event.clientX}px`;
    contextMenuPosition.top = `${event.clientY}px`;
    contextMenuVisible.value = true;
  } else {
    closeContextMenu(); 
  }
};

const closeContextMenu = () => {
  contextMenuVisible.value = false;
  contextMenuTargetNode.value = null;
};

const normalizePath = (path) => {
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
};

const triggerUploadLocalToNode = () => {
  if (!contextMenuTargetNode.value) return;
  const node = contextMenuTargetNode.value;
  if (node.type === 'dataset') {
    targetDatasetIdForUpload.value = String(node.id);
    targetDatasetNameForUpload.value = node.label || '';
    targetBasePathInDataset.value = ''; 
  } else if (node.type === 'folder') {
    targetDatasetIdForUpload.value = String(node.datasetId);
    const parentDataset = datasetStore.getDatasetById(node.datasetId);
    targetDatasetNameForUpload.value = parentDataset ? parentDataset.label : String(node.datasetId);
    targetBasePathInDataset.value = normalizePath(node.path); 
  } else {
    closeContextMenu();
    return;
  }
  uploadLocalFilesDialogVisible.value = true;
  closeContextMenu();
};

const triggerAddServerItemsToNode = () => {
  if (!contextMenuTargetNode.value) return;
  const node = contextMenuTargetNode.value;
  if (node.type === 'dataset') {
    targetDatasetIdForUpload.value = String(node.id);
    targetDatasetNameForUpload.value = node.label || '';
    targetBasePathInDataset.value = '';
  } else if (node.type === 'folder') {
    targetDatasetIdForUpload.value = String(node.datasetId);
    const parentDataset = datasetStore.getDatasetById(node.datasetId);
    targetDatasetNameForUpload.value = parentDataset ? parentDataset.label : String(node.datasetId);
    targetBasePathInDataset.value = normalizePath(node.path);
  } else {
    closeContextMenu();
    return;
  }
  addServerItemsDialogVisible.value = true;
  closeContextMenu();
};

const triggerAddUrlToNode = () => {
  if (!contextMenuTargetNode.value) return;
  const node = contextMenuTargetNode.value;
  if (node.type === 'dataset') {
    targetDatasetIdForUpload.value = String(node.id);
    targetDatasetNameForUpload.value = node.label || '';
    targetBasePathInDataset.value = '';
  } else if (node.type === 'folder') {
    targetDatasetIdForUpload.value = String(node.datasetId);
    const parentDataset = datasetStore.getDatasetById(node.datasetId);
    targetDatasetNameForUpload.value = parentDataset ? parentDataset.label : String(node.datasetId);
    targetBasePathInDataset.value = normalizePath(node.path);
  } else {
    closeContextMenu();
    return;
  }
  addUrlDialogVisible.value = true;
  closeContextMenu();
};

const handleLocalFilesUploaded = async () => {
  uploadLocalFilesDialogVisible.value = false;
  if (targetDatasetIdForUpload.value) {
    try {
      await datasetStore.fetchDatasetDetails(targetDatasetIdForUpload.value, true);
      const currentSelection = uiStore.selectedExplorerItem;
      if (currentSelection && currentSelection.id === targetDatasetIdForUpload.value && currentSelection.type === 'dataset') {
        uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[targetDatasetIdForUpload.value] });
      } else if (currentSelection && currentSelection.datasetId === targetDatasetIdForUpload.value && currentSelection.type === 'folder' && currentSelection.path === targetBasePathInDataset.value) {
        uiStore.selectExplorerItem({ ...currentSelection });
      }
    } catch (error) {
      console.error('Failed to refresh dataset details:', error);
      ElMessage.error(t('file.refreshFailed', { error: error.message || t('error.operationFailed') }));
      try {
        await datasetStore.fetchDatasets();
      } catch (retryError) {
        console.error('Failed to reload dataset list:', retryError);
        ElMessage.error(t('file.datasetInconsistent'));
      }
    }
  }
};

const handleServerItemsAdded = async () => {
  addServerItemsDialogVisible.value = false;
  if (targetDatasetIdForUpload.value) {
    try {
      await datasetStore.fetchDatasetDetails(targetDatasetIdForUpload.value, true);
      const currentSelection = uiStore.selectedExplorerItem;
      if (currentSelection && currentSelection.id === targetDatasetIdForUpload.value && currentSelection.type === 'dataset') {
        uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[targetDatasetIdForUpload.value] });
      } else if (currentSelection && currentSelection.datasetId === targetDatasetIdForUpload.value && currentSelection.type === 'folder' && currentSelection.path === targetBasePathInDataset.value) {
        uiStore.selectExplorerItem({ ...currentSelection });
      }
    } catch (error) {
      console.error('刷新数据集详情失败:', error);
      ElMessage.error(`文件已添加，但刷新数据集详情失败: ${error.message || '未知错误'}`);
      // 尝试重新加载数据集列表
      try {
        await datasetStore.fetchDatasets();
      } catch (retryError) {
        console.error('重新加载数据集列表失败:', retryError);
        ElMessage.error('数据集状态可能不一致，请刷新页面');
      }
    }
  }
};

const handleAddUrlFileAdded = async () => {
  addUrlDialogVisible.value = false;
  if (targetDatasetIdForUpload.value) {
    try {
      await datasetStore.fetchDatasetDetails(targetDatasetIdForUpload.value, true);
      const currentSelection = uiStore.selectedExplorerItem;
      if (currentSelection && currentSelection.id === targetDatasetIdForUpload.value && currentSelection.type === 'dataset') {
        uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[targetDatasetIdForUpload.value] });
      } else if (currentSelection && currentSelection.datasetId === targetDatasetIdForUpload.value && currentSelection.type === 'folder' && currentSelection.path === targetBasePathInDataset.value) {
        uiStore.selectExplorerItem({ ...currentSelection });
      }
    } catch (error) {
      console.error('刷新数据集详情失败:', error);
      ElMessage.error(`文件已添加，但刷新数据集详情失败: ${error.message || '未知错误'}`);
      // 尝试重新加载数据集列表
      try {
        await datasetStore.fetchDatasets();
      } catch (retryError) {
        console.error('重新加载数据集列表失败:', retryError);
        ElMessage.error('数据集状态可能不一致，请刷新页面');
      }
    }
  }
};


// --- Empty Dataset Dialog Logic ---
const handleOpenCreateEmptyDatasetDialog = () => {
  closeContextMenu();
  createEmptyDatasetDialogVisible.value = true;
};

const handleEmptyDatasetCreated = () => {
  createEmptyDatasetDialogVisible.value = false;
};

const clearDroppedFiles = () => {
  droppedFilesForDialog.value = [];
};

// Helper function to recursively read directory entries
async function readDirectoryEntries(directoryReader, pathPrefix = '') {
  return new Promise((resolve, reject) => {
    let accumulatedEntries = []; // Stores raw FileEntry/DirectoryEntry objects

    const processAccumulatedEntries = async () => {
      let files = [];
      for (const entry of accumulatedEntries) {
        if (entry.isFile) {
          try {
            const file = await new Promise((fileResolve, fileReject) => {
              entry.file(f => {
                Object.defineProperty(f, 'webkitRelativePath', {
                  value: pathPrefix + f.name,
                  writable: true,
                  configurable: true
                });
                fileResolve(f);
              }, fileReject);
            });
            files.push(file);
          } catch (err) {
            console.error('Error getting file from FileEntry:', err);
            // Optionally, push an error marker or skip. For now, errors are logged.
          }
        } else if (entry.isDirectory) {
          try {
            // Recursively process subdirectory
            const nestedFiles = await processDirectoryEntry(entry, pathPrefix + entry.name + '/');
            files = files.concat(nestedFiles); // Add files from subdirectory
          } catch (err) {
            console.error('Error processing subdirectory:', err);
            // Optionally, push an error marker or skip.
          }
        }
      }
      resolve(files);
    };

    const readBatch = () => {
      directoryReader.readEntries(
        (entries) => {
          if (entries.length > 0) {
            accumulatedEntries = accumulatedEntries.concat(entries);
            readBatch(); // Read next batch
          } else {
            // All entries read, now process them
            processAccumulatedEntries().catch(reject); // Process entries and handle potential errors
          }
        },
        (err) => {
          reject(err); // Error in reading entries
        }
      );
    };

    readBatch();
  });
}

// Helper function to process a single directory entry
async function processDirectoryEntry(directoryEntry, pathPrefix = '') {
  return new Promise((resolve, reject) => {
    if (directoryEntry.isDirectory) {
      const directoryReader = directoryEntry.createReader();
      readDirectoryEntries(directoryReader, pathPrefix)
        .then(resolve)
        .catch(reject);
    } else {
      // Handle case where a file entry is passed to processDirectoryEntry (should ideally not happen if called correctly)
      directoryEntry.file(file => {
         Object.defineProperty(file, 'webkitRelativePath', {
            value: pathPrefix + file.name, // pathPrefix might be just the directory name here
            writable: true,
            configurable: true
          });
        resolve([file]);
      }, reject);
    }
  });
}

const handleNodeDrop = async (draggingNode, dropNode, dropType, event) => {
  event.preventDefault();
  closeContextMenu();

  const targetNodeData = dropNode.data;
  if (!dropNode || !targetNodeData || targetNodeData.type === 'file') {
    if (dropType !== 'inner') {
        ElMessage.info(t('file.dropInstruction'));
        return;
    }
    ElMessage.warning(t('file.dropTargetInvalid'));
    return;
  }

  // Set target for upload dialogs
  targetDatasetIdForUpload.value = String(targetNodeData.type === 'dataset' ? targetNodeData.id : targetNodeData.datasetId);
  const parentDataset = datasetStore.getDatasetById(targetDatasetIdForUpload.value);
  targetDatasetNameForUpload.value = parentDataset ? parentDataset.label : String(targetDatasetIdForUpload.value);
  targetBasePathInDataset.value = targetNodeData.type === 'folder' ? normalizePath(targetNodeData.path) : '';
  
  // --- Groundwork for Server File Drag-and-Drop ---
  const isServerFileDrop = event.dataTransfer.types.includes('application/x-server-file-item');
  if (isServerFileDrop) {
    const serverItemDataString = event.dataTransfer.getData('application/x-server-file-item');
    try {
      const serverItem = JSON.parse(serverItemDataString);
      // serverItem should be like { path: '/path/on/server/file.txt', name: 'file.txt', type: 'file' or 'folder' }
      console.log('Server file drop detected (conceptual):', serverItem);
      const message = `${t('file.drop.serverItemDrop', { name: serverItem.name })}. ${t('file.drop.serverItemType', { type: serverItem.type })}. ${t('file.drop.serverItemPath', { path: serverItem.path })}. ${t('file.drop.featureInDevelopment')}`;
      ElMessage.info(message);
      
      // Future: Instead of just logging, this would trigger a confirmation and then
      // use apiService.uploadServerFileToDataset(...) or similar,
      // passing targetDatasetIdForUpload, targetBasePathInDataset, serverItem.path, serverItem.name, etc.
      // This would likely reuse or adapt parts of AddFilesDialog's logic for server files.
    } catch (e) {
      console.error("Error parsing server file drop data:", e);
      ElMessage.error(t('file.drop.invalidServerData'));
    }
    return; // Stop further processing if it's a server file drop
  }
  // --- End Groundwork for Server File Drag-and-Drop ---

  const items = event.dataTransfer.items;
  const filesToAdd = []; // Only used for the fallback event.dataTransfer.files
  const filePromises = [];

  if (items && items.length > 0 && Array.from(items).some(item => item.kind === 'file')) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isFile) {
            filePromises.push(new Promise((resolve, reject) => {
              entry.file(file => {
                // For single files, webkitRelativePath might be just the filename or empty.
                // We'll set it to entry.name for consistency if it's not already more specific.
                const currentRelativePath = file.webkitRelativePath;
                if (!currentRelativePath || currentRelativePath === file.name) {
                   Object.defineProperty(file, 'webkitRelativePath', { 
                     value: entry.name, // Use entry.name as the base relative path for standalone files
                     configurable: true, 
                     writable: true 
                    });
                }
                resolve(file);
              }, reject);
            }));
          } else if (entry.isDirectory) {
            // Use the new recursive function for directories
            filePromises.push(processDirectoryEntry(entry, entry.name + '/'));
          }
        }
      }
    }

    Promise.all(filePromises.map(p => p.catch(e => {
        console.error("Error processing a dropped item:", e);
        return { error: true, details: e };
    })))
    .then(results => {
        const allFiles = results.flat().filter(file => file && !file.error);
        if (allFiles.length > 0) {
            droppedFilesForDialog.value = allFiles;
            uploadLocalFilesDialogVisible.value = true;
        } else if (items.length > 0 && allFiles.length === 0) {
            ElMessage.warning(t('file.noValidFilesDropped'));
        } else { // No items of kind 'file' or other issue
             ElMessage.warning(t('file.noFilesDropped'));
        }
    }).catch(err => {
        console.error('Error processing dropped files:', err);
        ElMessage.error(t('file.dropError'));
    });

  } else if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    // Fallback for event.dataTransfer.files (less reliable for folders)
    for (let i = 0; i < event.dataTransfer.files.length; i++) {
        const file = event.dataTransfer.files[i];
        // For this fallback, webkitRelativePath is usually not available or just the filename
        // Best effort: use filename if webkitRelativePath is empty
        const relativePath = file.webkitRelativePath || file.name; 
        Object.defineProperty(file, 'webkitRelativePath', { value: relativePath, configurable: true, writable: true });
        filesToAdd.push(file);
    }
    if (filesToAdd.length > 0) {
        droppedFilesForDialog.value = filesToAdd;
        uploadLocalFilesDialogVisible.value = true;
    } else {
         ElMessage.warning(t('file.noFilesDropped'));
    }
  } else {
    // Neither items nor files found, or items found but none are 'file' kind.
    ElMessage.warning(t('file.noFilesDropped'));
  }
};


// handleServerPathSegmentClick might be used by AddFilesDialog, will keep for now
const handleServerPathSegmentClick = (index) => {
  fileBrowserStore.navigateToPathSegment(index);
};

// Lifecycle hooks for context menu
onMounted(async () => { 
    document.addEventListener('click', closeContextMenu);
    await datasetStore.fetchDatasets(); 
    await datasetStore.fetchDatasetConstraints(); 
    // Removed fileBrowserStore.fetchFiles call as it was tied to the "File Sources" tab.
    // If server file browsing is needed for other features like "Add Server Items" dialog,
    // it should be triggered by that specific component/dialog.
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu);
});

// 添加缺失的响应式变量
const createDatasetDialogVisible = ref(false);
const processedFilesForDialog = ref([]);

const handleDatasetCreatedWithFiles = async (datasetData) => {
  try {
    await datasetStore.createDataset(datasetData);
    ElMessage.success(t('dataset.createSuccess'));
  } catch (error) {
    ElMessage.error(t('dataset.createFailed') + ': ' + error.message);
  }
};

</script>

<style scoped>
.explorer-panel-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.explorer-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.collapse-title-text {
  flex-grow: 1;
  color: var(--el-text-color-primary);
}

.collapse-header-action-btn {
  margin-right: 10px;
  padding: 0 5px;
  color: var(--el-text-color-regular);
}

.collapse-header-action-btn .el-icon {
  margin-right: 4px;
}

/* Removed styles for .local-file-source-tab, .local-file-uploader, .url-fetch-source-tab, 
   .selected-files-panel-for-new-dataset, .create-dataset-action-panel */

.explorer-panel :deep(.el-collapse-item__header) {
  background-color: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color-light);
  padding-left: 10px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.explorer-panel :deep(.el-collapse-item__wrap) {
  background-color: var(--el-bg-color);
  border-bottom: none;
}

.explorer-panel :deep(.el-collapse-item__content) {
  padding: 0;
  color: var(--el-text-color-regular);
}

/* Removed styles for .el-tabs, .server-file-browser, .path-selector, .path-navigation, .file-name */

.dataset-loading-indicator, .dataset-error-message {
  padding: 10px;
  font-size: 13px;
  text-align: center;
  color: var(--el-text-color-regular);
}

.dataset-loading-indicator .progress-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 5px;
}

.dataset-error-message {
  color: var(--el-color-danger);
}

.explorer-panel :deep(.dataset-tree) {
  background-color: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  padding: 5px 0;
}

.explorer-panel :deep(.dataset-tree .el-tree-node__content) {
  height: 28px;
  padding-right: 10px;
  background-color: transparent !important;
}

.explorer-panel :deep(.dataset-tree .el-tree-node__content:hover) {
  background-color: var(--el-fill-color-light) !important;
}

.explorer-panel :deep(.dataset-tree .el-tree-node:focus > .el-tree-node__content) {
  background-color: var(--el-fill-color-light) !important;
}

.explorer-panel :deep(.dataset-tree .el-tree-node.is-current > .el-tree-node__content) {
  background-color: var(--el-fill-color-light) !important;
}

.explorer-panel :deep(.dataset-tree .el-tree-node__label) {
  color: var(--el-text-color-regular);
}

.explorer-panel :deep(.dataset-tree .el-tree-node.is-current > .el-tree-node__content .el-tree-node__label) {
  color: var(--el-text-color-primary);
}

.explorer-panel :deep(.el-tree__empty-text) {
  color: var(--el-text-color-regular);
  font-size: 13px;
  text-align: center;
  padding: 10px;
}

.tree-node-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-size: 13px;
}

.node-label {
  display: flex;
  align-items: center;
  overflow: hidden;
}

.node-text {
  margin-left: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dataset-icon-wrapper .el-icon, .folder-icon-wrapper .el-icon, .file-icon-wrapper .el-icon {
  font-size: 14px;
  vertical-align: middle;
}

.file-icon-wrapper svg {
  width: 1em;
  height: 1em;
  font-size: 14px;
}

.dataset-icon-wrapper .el-icon {
  color: var(--el-color-warning);
}

.folder-icon-wrapper .el-icon {
  color: var(--el-color-primary);
}

.node-actions {
  display: none;
  margin-left: 8px;
}

.explorer-panel :deep(.el-tree-node__content:hover .node-actions) {
  display: inline-block;
}

.delete-dataset-btn .el-icon {
  font-size: 14px;
}

.delete-dataset-btn:hover .el-icon {
  color: var(--el-color-danger);
}

.file-meta-info {
  font-size: 11px;
  color: var(--el-text-color-regular);
  margin-left: 8px;
  white-space: nowrap;
}

/* Removed styles for .el-table, .file-table-row, .el-table__empty-text, .el-skeleton__item, 
   .empty-state, .loading-state, .el-empty__description, .placeholder-tab-content */

.explorer-panel .el-icon {
  color: var(--el-text-color-regular);
}

.custom-context-menu {
  position: fixed;
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.3);
  padding: 5px 0;
  z-index: 3000;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.custom-context-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.custom-context-menu ul li {
  padding: 8px 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.custom-context-menu ul li .el-icon {
  margin-right: 8px;
  font-size: 14px;
}

.custom-context-menu ul li:hover {
  background-color: var(--el-fill-color-light);
}
</style>
