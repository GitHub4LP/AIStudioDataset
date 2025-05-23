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
        <el-collapse-item :title="t('file.source')" name="fileSources">
          <el-tabs v-model="activeFileSourceTab" @tab-change="handleFileSourceTabChange">
            <el-tab-pane :label="t('file.server')" name="server">
              <div class="server-file-browser">
                <div class="path-selector">
                  <el-select 
                      v-model="fileBrowserStore.selectedBasePath" 
                      :placeholder="t('file.selectBasePath')" 
                      @change="fileBrowserStore.changeBasePath" 
                      size="small"
                  >
                    <el-option
                      v-for="pathItem in fileBrowserStore.basePaths"
                      :key="pathItem.value"
                      :label="pathItem.label"
                      :value="pathItem.value"
                    />
                  </el-select>
                </div>
                <div class="path-navigation">
                  <el-breadcrumb separator="/">
                    <el-breadcrumb-item
                      v-for="(item, index) in fileBrowserStore.pathSegments"
                      :key="index"
                      @click="handleServerPathSegmentClick(index)"
                    >
                      {{ item }}
                    </el-breadcrumb-item>
                  </el-breadcrumb>
                </div>

                <div v-if="fileBrowserStore.isLoading" class="loading-state">
                  <el-skeleton :rows="3" animated />
                </div>
                 <div v-else-if="fileBrowserStore.error" class="dataset-error-message">
                    {{ t('file.getFileListFailed') }}: {{ fileBrowserStore.error }}
                 </div>
                <el-table
                  v-else-if="fileBrowserStore.serverFiles.length > 0"
                  :data="fileBrowserStore.serverFiles"
                  style="width: 100%"
                  height="200px" 
                  size="small"
                  :show-header="false"
                  row-class-name="file-table-row"
                  :empty-text="t('file.empty')"
                  @selection-change="handleNewDatasetServerFileSelectionChange"
                  ref="serverFileSelectionTableRef"
                >
                  <el-table-column type="selection" width="45" :selectable="isServerFileSelectableForNewDataset" />
                  <el-table-column prop="name" :label="t('file.name')">
                    <template #default="{ row }">
                      <div class="file-name" @click="handleServerFileOrFolderClick(row)">
                        <el-icon v-if="row.type === '文件夹'"><Folder /></el-icon>
                        <el-icon v-else><Document /></el-icon>
                        <span>{{ row.name }}</span>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-else class="empty-state">
                  <el-empty :description="t('file.empty')" :image-size="50" />
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane :label="t('file.local')" name="local">
              <div class="local-file-source-tab">
                <el-upload
                  ref="localFileUploaderRef"
                  action="#" 
                  :http-request="customLocalUploadRequest"
                  :on-change="handleLocalFileSelectionChange"
                  :on-remove="handleLocalFileRemoveFromDisplay"
                  :file-list="localFileDisplayList"
                  :multiple="true"
                  :auto-upload="true" 
                  drag
                  class="local-file-uploader"
                >
                  <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                  <div class="el-upload__text">{{ t('file.dragOrClick') }}</div>
                  <template #tip>
                    <div class="el-upload__tip">
                      {{ t('file.autoAddTip') }}
                    </div>
                  </template>
                </el-upload>
                <el-button @click="triggerLocalFolderInput" size="small" style="margin-top: 10px;">{{ t('file.selectFolder') }}</el-button>
                <input 
                  type="file" 
                  webkitdirectory 
                  multiple 
                  style="display: none" 
                  ref="localFolderInputRef" 
                  @change="handleLocalFolderInputChange" 
                />
              </div>
            </el-tab-pane>
            <el-tab-pane :label="t('file.urlFetch')" name="url">
              <div class="url-fetch-source-tab">
                <el-form :model="urlFetchForm" ref="urlFetchFormRef" label-width="80px" size="small">
                  <el-form-item :label="t('file.url')" prop="url" :rules="[{ required: true, message: t('file.urlRequired'), trigger: 'blur' }, { type: 'url', message: t('file.urlInvalid'), trigger: ['blur', 'change'] }]">
                    <el-input v-model="urlFetchForm.url" :placeholder="t('file.urlPlaceholder')"></el-input>
                  </el-form-item>
                  <el-form-item :label="t('file.name')" prop="fileName" :rules="[{ required: true, message: t('file.nameRequired'), trigger: 'blur' }]">
                    <el-input v-model="urlFetchForm.fileName" :placeholder="t('file.namePlaceholder')"></el-input>
                  </el-form-item>
                  <el-form-item :label="t('file.referer')" prop="referer">
                    <el-input v-model="urlFetchForm.referer" :placeholder="t('file.optional')"></el-input>
                  </el-form-item>
                  <el-form-item :label="t('file.userAgent')" prop="userAgent">
                    <el-input v-model="urlFetchForm.userAgent" :placeholder="t('file.optional')"></el-input>
                  </el-form-item>
                  <el-form-item>
                    <el-button 
                      type="primary" 
                      @click="handleUrlFetchAndAddToList" 
                      :loading="isProcessingUrlFile"
                      style="width: 100%;"
                    >
                      {{ isProcessingUrlFile ? t('file.fetching') : t('file.fetchAndAdd') }}
                    </el-button>
                  </el-form-item>
                </el-form>
              </div>
            </el-tab-pane>
          </el-tabs>

          <div v-if="allSelectedFilesForNewDataset.length > 0" class="selected-files-panel-for-new-dataset">
            <h4>{{ t('file.selectedFiles') }}:</h4>
            <el-table :data="allSelectedFilesForNewDataset" size="small" height="120px" :key="allSelectedFilesForNewDataset.length">
              <el-table-column prop="name" :label="t('file.name')" />
              <el-table-column prop="source" :label="t('file.source')" width="100" />
              <el-table-column :label="t('file.operation')" width="60">
                <template #default="{ row }">
                  <el-button link type="danger" size="small" @click="removeFileFromNewDatasetSelection(row)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div class="create-dataset-action-panel">
            <el-button 
              type="primary" 
              @click="handleOpenCreateDatasetDialog" 
              :disabled="isProcessingNewDatasetFiles || isProcessingLocalFiles || isProcessingUrlFile"
              :loading="isProcessingNewDatasetFiles || isProcessingLocalFiles || isProcessingUrlFile"
              style="width: 100%; margin-top: 10px;"
            >
              {{ overallProcessingButtonText }}
            </el-button>
          </div>

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
      @update:visible="uploadLocalFilesDialogVisible = $event"
      @files-added="handleLocalFilesUploaded"
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

const activeCollapseNames = ref(['datasets', 'fileSources']);
const activeFileSourceTab = ref('server');
const datasetTreeProps = { label: 'label', children: 'children', isLeaf: 'isFileNode' }; 
const serverFileSelectionTableRef = ref(null);
const localFileUploaderRef = ref(null);
const localFolderInputRef = ref(null);
const localFileDisplayList = ref([]); 

// --- State for New Dataset Creation (with files) ---
const newDatasetSelectedServerFiles = ref([]); 
const newDatasetSelectedLocalFiles = ref([]); 
const newDatasetSelectedUrlFiles = ref([]); 

const allSelectedFilesForNewDataset = computed(() => [
    ...newDatasetSelectedServerFiles.value.map(f => ({ ...f, name: f.name, source: '服务器', uniqueId: `server-${f.path}` })),
    ...newDatasetSelectedLocalFiles.value, 
    ...newDatasetSelectedUrlFiles.value, 
]);

const createDatasetDialogVisible = ref(false); 
const isProcessingNewDatasetFiles = ref(false); 
const isProcessingLocalFiles = ref(false); 
const isProcessingUrlFile = ref(false); 
const processedFilesForDialog = ref([]); 

const overallProcessingButtonText = computed(() => {
    if (isProcessingNewDatasetFiles.value) return t('file.processingServerFiles');
    if (isProcessingLocalFiles.value) return t('file.processingLocalFiles');
    if (isProcessingUrlFile.value) return t('file.processingUrlFiles');
    return t('file.createDataset');
});

const urlFetchFormRef = ref(null);
const urlFetchForm = ref({ url: '', fileName: '', referer: '', userAgent: '' });

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


// --- File Sources Section Logic (for creating dataset with files) ---
const handleServerFileOrFolderClick = (item) => { 
    closeContextMenu();
    if (item.type === '文件夹') {
        let newPath = item.name; 
        if (fileBrowserStore.currentPath && fileBrowserStore.currentPath !== '.') {
            newPath = `${fileBrowserStore.currentPath}/${item.name}`;
        }
        fileBrowserStore.fetchFiles(newPath); 
    }
};

const isServerFileSelectableForNewDataset = (row) => row.type === '文件'; 
const handleNewDatasetServerFileSelectionChange = (selection) => { 
    newDatasetSelectedServerFiles.value = selection.map(s => ({
        ...s, 
        path: fileBrowserStore.currentPath === '.' ? s.name : `${fileBrowserStore.currentPath}/${s.name}` 
    }));
};

const handleServerPathSegmentClick = (index) => {
  fileBrowserStore.navigateToPathSegment(index);
};

const handleLocalFileSelectionChange = (file, fileList) => {
    localFileDisplayList.value = fileList;
};
const handleLocalFileRemoveFromDisplay = (file, fileList) => {
    localFileDisplayList.value = fileList;
    newDatasetSelectedLocalFiles.value = newDatasetSelectedLocalFiles.value.filter(f => f.uid !== file.uid);
};

const customLocalUploadRequest = async ({ file }) => { 
    isProcessingLocalFiles.value = true;
    try {
        const formData = new FormData();
        formData.append('file', file); 
        
        const result = await apiService.uploadLocalFile(formData); 
        newDatasetSelectedLocalFiles.value.push({
            fileId: result.fileId, 
            fileAbs: result.fileAbs, 
            name: file.name, 
            uid: file.uid, 
            source: t('file.local'),
            uniqueId: `local-${file.name}-${file.size}-${result.fileId || Date.now()}` 
        });
        ElMessage.success(t('file.fileProcessSuccess', { name: file.name }));
        localFileDisplayList.value = localFileDisplayList.value.filter(f => f.uid !== file.uid);
    } catch (error) {
        console.error('Error processing local file:', error);
        ElMessage.error(t('file.fileProcessFailed', { name: file.name, error: error.message || t('error.operationFailed') }));
        localFileDisplayList.value = localFileDisplayList.value.filter(f => f.uid !== file.uid); 
    } finally {
        isProcessingLocalFiles.value = false; 
    }
};

const triggerLocalFolderInput = () => { localFolderInputRef.value?.click(); };

const handleLocalFolderInputChange = async (event) => { 
    const files = event.target.files;
    if (!files || files.length === 0) return;
    isProcessingLocalFiles.value = true;
    let successCount = 0;
    const filesToProcess = Array.from(files); 

    for (const file of filesToProcess) {
        try {
            const formData = new FormData();
            formData.append('file', file); 
            const result = await apiService.uploadLocalFile(formData);
            newDatasetSelectedLocalFiles.value.push({
                fileId: result.fileId,
                fileAbs: result.fileAbs, 
                name: file.name, 
                source: t('file.local'),
                uniqueId: `local-folder-${file.webkitRelativePath || file.name}-${result.fileId || Date.now()}`
            });
            successCount++;
        } catch (error) {
            console.error(`Error processing folder file ${file.name}:`, error);
            ElMessage.error(t('file.fileProcessFailed', { name: file.name, error: error.message || t('error.operationFailed') }));
        }
    }
    if (successCount > 0) ElMessage.success(t('file.folderFilesProcessed', { count: successCount }));
    if (successCount !== filesToProcess.length) ElMessage.warning(t('file.folderFilesPartialFailed'));
    
    if(localFolderInputRef.value) localFolderInputRef.value.value = ''; 
    isProcessingLocalFiles.value = false;
};

const handleUrlFetchAndAddToList = async () => {
    if (!urlFetchFormRef.value) return;
    urlFetchFormRef.value.validate(async (valid) => {
        if (valid) {
            isProcessingUrlFile.value = true;
            try {
                const result = await apiService.fetchUrlToDataset({ 
                    url: urlFetchForm.value.url,
                    fileName: urlFetchForm.value.fileName, 
                    referer: urlFetchForm.value.referer,
                    userAgent: urlFetchForm.value.userAgent,
                }); 
                newDatasetSelectedUrlFiles.value.push({
                    fileId: result.fileId,
                    fileAbs: result.fileAbs, 
                    name: urlFetchForm.value.fileName, 
                    source: t('file.urlFetch'),
                    uniqueId: `url-${result.fileId || urlFetchForm.value.fileName}` 
                });
                ElMessage.success(t('file.urlFileSuccess', { name: urlFetchForm.value.fileName }));
                urlFetchFormRef.value.resetFields();
            } catch (error) {
                console.error('Error fetching URL file:', error);
                ElMessage.error(t('file.urlFileFailed', { error: error.message || t('error.operationFailed') }));
            } finally {
                isProcessingUrlFile.value = false;
            }
        } else {
            ElMessage.error(t('file.checkUrlForm'));
            return false;
        }
    });
};

const handleFileSourceTabChange = (tabName) => {
    if (tabName === 'server' && fileBrowserStore.serverFiles.length === 0) {
        fileBrowserStore.fetchFiles(fileBrowserStore.selectedBasePath);
    }
};

const removeFileFromNewDatasetSelection = (fileToRemove) => { 
  if (fileToRemove.source === '服务器') {
    newDatasetSelectedServerFiles.value = newDatasetSelectedServerFiles.value.filter(f => f.uniqueId !== fileToRemove.uniqueId);
    const tableInstance = serverFileSelectionTableRef.value;
    if (tableInstance) {
        const originalFile = fileBrowserStore.serverFiles.find(sf => {
            const pathToCheck = fileBrowserStore.currentPath === '.' ? sf.name : `${fileBrowserStore.currentPath}/${sf.name}`;
            return `server-${pathToCheck}` === fileToRemove.uniqueId;
        });
        if (originalFile) tableInstance.toggleRowSelection(originalFile, false);
    }
  } else if (fileToRemove.source === '本地' || fileToRemove.source === '本地 (文件夹)') {
    newDatasetSelectedLocalFiles.value = newDatasetSelectedLocalFiles.value.filter(f => f.uniqueId !== fileToRemove.uniqueId);
    localFileDisplayList.value = localFileDisplayList.value.filter(f => f.uid !== fileToRemove.uid); 
  } else if (fileToRemove.source === 'URL') {
    newDatasetSelectedUrlFiles.value = newDatasetSelectedUrlFiles.value.filter(f => f.uniqueId !== fileToRemove.uniqueId);
  }
};

const handleOpenCreateDatasetDialog = async () => {
  closeContextMenu();
  
  let filesForDialog = [];
  filesForDialog.push(...newDatasetSelectedLocalFiles.value.map(f => ({fileId: f.fileId, fileAbs: f.fileAbs, name: f.name})));
  filesForDialog.push(...newDatasetSelectedUrlFiles.value.map(f => ({fileId: f.fileId, fileAbs: f.fileAbs, name: f.name})));
  
  if (newDatasetSelectedServerFiles.value.length > 0) {
    isProcessingNewDatasetFiles.value = true; 
    try {
      for (const serverFile of newDatasetSelectedServerFiles.value) {
        const result = await apiService.registerServerFile({ filePath: serverFile.path, fileName: serverFile.name });
        filesForDialog.push({ fileId: result.fileId, fileAbs: result.fileAbs, name: serverFile.name });
      }
    } catch (error) {
      console.error("Error processing server files for new dataset:", error);
      ElMessage.error(`处理服务器文件时出错: ${error.message || '未知错误'}`);
      isProcessingNewDatasetFiles.value = false;
      return; 
    } finally {
      isProcessingNewDatasetFiles.value = false;
    }
  }
    
  processedFilesForDialog.value = filesForDialog;
  createDatasetDialogVisible.value = true;
};

const handleDatasetCreatedWithFiles = () => { 
    newDatasetSelectedServerFiles.value = [];
    newDatasetSelectedLocalFiles.value = []; 
    newDatasetSelectedUrlFiles.value = [];
    localFileDisplayList.value = []; 
    if(serverFileSelectionTableRef.value) serverFileSelectionTableRef.value.clearSelection();
    processedFilesForDialog.value = []; 
    if(urlFetchFormRef.value) urlFetchFormRef.value.resetFields();
};

// Lifecycle hooks for context menu
onMounted(async () => { 
    document.addEventListener('click', closeContextMenu);
    await datasetStore.fetchDatasets(); 
    await datasetStore.fetchDatasetConstraints(); 
    if (activeFileSourceTab.value === 'server') {
        await fileBrowserStore.fetchFiles(fileBrowserStore.currentPath); 
    }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu);
});

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

.local-file-source-tab {
  padding: 10px;
  background-color: var(--el-bg-color-overlay);
}

.local-file-uploader :deep(.el-upload-dragger) {
  padding: 20px 10px;
  background-color: var(--el-bg-color);
  border: 1px dashed var(--el-border-color-light);
}

.local-file-uploader :deep(.el-icon--upload) {
  font-size: 40px;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
}

.local-file-uploader :deep(.el-upload__text) {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.url-fetch-source-tab {
  padding: 15px;
  background-color: var(--el-bg-color-overlay);
}

.selected-files-panel-for-new-dataset {
  margin-top: 15px;
  padding: 10px;
  background-color: var(--el-bg-color-overlay);
  border-radius: 4px;
}

.selected-files-panel-for-new-dataset h4 {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.selected-files-panel-for-new-dataset :deep(.el-table th) {
  background-color: var(--el-bg-color-overlay) !important;
  color: var(--el-text-color-regular) !important;
  font-weight: normal;
}

.selected-files-panel-for-new-dataset :deep(.el-table td, .el-table th) {
  padding: 3px 0;
  font-size: 12px;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-regular);
}

.selected-files-panel-for-new-dataset :deep(.el-button--small) {
  padding: 2px 5px;
}

.create-dataset-action-panel {
  padding: 0px 10px 10px 10px;
}

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

.explorer-panel :deep(.el-tabs__header) {
  margin-bottom: 0px;
}

.explorer-panel :deep(.el-tabs__nav-wrap) {
  padding: 0 10px;
}

.explorer-panel :deep(.el-tabs__nav-wrap::after) {
  background-color: var(--el-border-color-light);
  height: 1px;
}

.explorer-panel :deep(.el-tabs__item) {
  color: var(--el-text-color-regular);
  font-size: 13px;
  padding: 0 10px;
  height: 35px;
  line-height: 35px;
}

.explorer-panel :deep(.el-tabs__item.is-active) {
  color: var(--el-text-color-primary);
}

.server-file-browser {
  font-size: 13px;
  padding: 8px 10px;
  background-color: var(--el-bg-color-overlay);
}

.path-selector {
  margin-bottom: 8px;
}

.path-selector :deep(.el-select) {
  width: 100%;
}

.path-navigation {
  margin-bottom: 8px;
  padding: 6px;
  background: var(--el-bg-color-overlay);
  border-radius: 3px;
  font-size: 12px;
}

.path-navigation :deep(.el-breadcrumb__item .el-breadcrumb__inner) {
  color: var(--el-text-color-regular) !important;
  cursor: pointer;
}

.path-navigation :deep(.el-breadcrumb__item .el-breadcrumb__inner:hover) {
  color: var(--el-color-primary) !important;
}

.path-navigation :deep(.el-breadcrumb__separator) {
  color: var(--el-text-color-regular) !important;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.file-name span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-name:hover {
  color: var(--el-color-primary);
}

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

.explorer-panel :deep(.el-table td), .explorer-panel :deep(.el-table th) {
  padding: 4px 0;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-regular);
}

.explorer-panel :deep(.file-table-row) {
  background-color: var(--el-bg-color) !important;
  color: var(--el-text-color-regular);
}

.explorer-panel :deep(.file-table-row:hover > td) {
  background-color: var(--el-fill-color-light) !important;
}

.explorer-panel :deep(.el-table__empty-text) {
  color: var(--el-text-color-regular);
}

.explorer-panel :deep(.el-skeleton__item) {
  background-color: var(--el-fill-color-light);
}

.empty-state, .loading-state {
  margin-top: 10px;
  padding: 10px;
  color: var(--el-text-color-regular);
}

.explorer-panel :deep(.el-empty__description) {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.explorer-panel .el-icon {
  color: var(--el-text-color-regular);
}

.placeholder-tab-content {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-regular);
  font-size: 13px;
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
