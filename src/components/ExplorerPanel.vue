<template>
  <div class="explorer-panel" @click="closeContextMenu">
    <el-collapse v-model="activeCollapseNames">
      <el-collapse-item name="datasets">
        <template #title>
          <span class="collapse-title-text">数据集</span>
          <el-button
            type="primary"
            link
            size="small"
            @click.stop="handleOpenCreateEmptyDatasetDialog"
            class="collapse-header-action-btn"
            title="创建新的空数据集"
          >
            <el-icon><Plus /></el-icon> 新建空数据集
          </el-button>
        </template>
        <div v-if="datasetStore.isLoadingDatasets && Object.keys(datasetStore.detailedDatasets).length === 0" class="dataset-loading-indicator">
          <el-skeleton :rows="3" animated />
          <div class="progress-text">加载中... {{ datasetStore.loadedPages }}/{{ datasetStore.totalPages }} 页</div>
        </div>
        <div v-else-if="datasetStore.datasetError" class="dataset-error-message">
          加载数据集出错: {{ datasetStore.datasetError }}
        </div>
        <el-tree
          v-else
          :data="builtDatasetTreeData"
          :props="datasetTreeProps"
          node-key="id"
          highlight-current
          class="dataset-tree"
          empty-text="暂无数据集"
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
                  @click.stop="confirmDeleteDataset(data)"
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
      <el-collapse-item title="文件源 (通过文件创建新数据集)" name="fileSources">
        <el-tabs v-model="activeFileSourceTab" @tab-change="handleFileSourceTabChange">
          <el-tab-pane label="服务器文件" name="server">
            <div class="server-file-browser">
              <div class="path-selector">
                <el-select 
                    v-model="fileBrowserStore.selectedBasePath" 
                    placeholder="选择基础路径" 
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
                 获取文件列表失败: {{ fileBrowserStore.error }}
               </div>
              <el-table
                v-else-if="fileBrowserStore.serverFiles.length > 0"
                :data="fileBrowserStore.serverFiles"
                style="width: 100%"
                height="200px" 
                size="small"
                :show-header="false"
                row-class-name="file-table-row"
                empty-text="当前目录为空"
                @selection-change="handleNewDatasetServerFileSelectionChange"
                ref="serverFileSelectionTableRef"
              >
                <el-table-column type="selection" width="45" :selectable="isServerFileSelectableForNewDataset" />
                <el-table-column prop="name" label="文件名">
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
                <el-empty description="当前目录为空" :image-size="50" />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="本地文件" name="local">
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
                <div class="el-upload__text">拖拽文件到此处或 <em>点击上传</em></div>
                 <template #tip>
                    <div class="el-upload__tip">
                        文件处理后将自动添加至下方"已选文件"列表。
                    </div>
                </template>
              </el-upload>
               <el-button @click="triggerLocalFolderInput" size="small" style="margin-top: 10px;">选择文件夹</el-button>
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
          <el-tab-pane label="URL抓取" name="url">
             <div class="url-fetch-source-tab">
                <el-form :model="urlFetchForm" ref="urlFetchFormRef" label-width="80px" size="small">
                    <el-form-item label="文件URL" prop="url" :rules="[{ required: true, message: '请输入URL', trigger: 'blur' }, { type: 'url', message: '请输入有效的URL', trigger: ['blur', 'change'] }]">
                        <el-input v-model="urlFetchForm.url" placeholder="http(s)://..."></el-input>
                    </el-form-item>
                    <el-form-item label="文件名" prop="fileName" :rules="[{ required: true, message: '请输入文件名', trigger: 'blur' }]">
                        <el-input v-model="urlFetchForm.fileName" placeholder="例如: data.zip"></el-input>
                    </el-form-item>
                    <el-form-item label="Referer" prop="referer">
                        <el-input v-model="urlFetchForm.referer" placeholder="可选"></el-input>
                    </el-form-item>
                    <el-form-item label="User-Agent" prop="userAgent">
                        <el-input v-model="urlFetchForm.userAgent" placeholder="可选"></el-input>
                    </el-form-item>
                    <el-form-item>
                        <el-button 
                            type="primary" 
                            @click="handleUrlFetchAndAddToList" 
                            :loading="isProcessingUrlFile"
                            style="width: 100%;"
                        >
                          {{ isProcessingUrlFile ? '抓取中...' : '抓取并添加文件' }}
                        </el-button>
                    </el-form-item>
                </el-form>
             </div>
          </el-tab-pane>
        </el-tabs>

        <div v-if="allSelectedFilesForNewDataset.length > 0" class="selected-files-panel-for-new-dataset">
          <h4>已选文件 (准备创建新数据集):</h4>
          <el-table :data="allSelectedFilesForNewDataset" size="small" height="120px" :key="allSelectedFilesForNewDataset.length">
            <el-table-column prop="name" label="文件名" />
            <el-table-column prop="source" label="来源" width="100" />
            <el-table-column label="操作" width="60">
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
            :disabled="allSelectedFilesForNewDataset.length === 0 || isProcessingNewDatasetFiles || isProcessingLocalFiles || isProcessingUrlFile"
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
          <el-icon><Upload /></el-icon> 上传本地文件/文件夹到此...
        </li>
         <li v-if="contextMenuTargetNode && (contextMenuTargetNode.type === 'dataset' || contextMenuTargetNode.type === 'folder')" 
            @click="triggerAddServerItemsToNode">
          <el-icon><FolderAdd /></el-icon> 从服务器添加文件/文件夹到此...
        </li>
        <li v-if="contextMenuTargetNode && (contextMenuTargetNode.type === 'dataset' || contextMenuTargetNode.type === 'folder')" 
            @click="triggerAddUrlToNode">
          <el-icon><LinkIcon /></el-icon> 通过URL添加文件到此...
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
// Import the utility functions
import { getFileIconPath, getFileIconColor, formatFileSize } from '@/utils/fileDisplayUtils'; 

import { useDatasetStore } from '@/stores/datasetStore';
import { useUIStore } from '@/stores/uiStore';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';

const datasetStore = useDatasetStore();
const uiStore = useUIStore();
const fileBrowserStore = useFileBrowserStore();

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
    if (isProcessingNewDatasetFiles.value) return '处理服务器文件中...';
    if (isProcessingLocalFiles.value) return '处理本地文件中...';
    if (isProcessingUrlFile.value) return '处理URL文件中...';
    return '通过文件创建新数据集';
});

const urlFetchFormRef = ref(null);
const urlFetchForm = ref({ url: '', fileName: '', referer: '', userAgent: '' });

// --- State for New Empty Dataset Creation ---
const createEmptyDatasetDialogVisible = ref(false);

// --- State for Target Operations (Context Menu Triggered) ---
const targetDatasetIdForUpload = ref(null); 
const targetDatasetNameForUpload = ref(null); 
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
    ElMessage.error("无法确定要删除的数据集。");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定要删除数据集 "${datasetNodeData.label}" 吗？此操作不可恢复！`,
      '删除数据集确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning', customClass: 'dark-message-box' }
    );
    await datasetStore.deleteDataset(datasetNodeData.id);
    ElMessage.success(`数据集 "${datasetNodeData.label}" 已删除。`);
    if (uiStore.selectedExplorerItem?.id === datasetNodeData.id) {
      uiStore.clearSelectedExplorerItem();
    }
  } catch (error) {
    if (error !== 'cancel' && error.message !== 'cancel' && error.name !== 'cancel') {
      console.error('删除数据集失败:', error);
      ElMessage.error(`删除失败: ${error.message || '未知错误'}`);
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

const triggerUploadLocalToNode = () => {
  if (!contextMenuTargetNode.value) return;
  const node = contextMenuTargetNode.value;
  if (node.type === 'dataset') {
    targetDatasetIdForUpload.value = node.id;
    targetDatasetNameForUpload.value = node.label;
    targetBasePathInDataset.value = ''; 
  } else if (node.type === 'folder') {
    targetDatasetIdForUpload.value = node.datasetId;
    const parentDataset = datasetStore.getDatasetById(node.datasetId);
    targetDatasetNameForUpload.value = parentDataset ? parentDataset.label : node.datasetId;
    targetBasePathInDataset.value = node.path; 
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
    targetDatasetIdForUpload.value = node.id;
    targetDatasetNameForUpload.value = node.label;
    targetBasePathInDataset.value = '';
  } else if (node.type === 'folder') {
    targetDatasetIdForUpload.value = node.datasetId;
    const parentDataset = datasetStore.getDatasetById(node.datasetId);
    targetDatasetNameForUpload.value = parentDataset ? parentDataset.label : node.datasetId;
    targetBasePathInDataset.value = node.path;
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
    targetDatasetIdForUpload.value = node.id;
    targetDatasetNameForUpload.value = node.label;
    targetBasePathInDataset.value = '';
  } else if (node.type === 'folder') {
    targetDatasetIdForUpload.value = node.datasetId;
    const parentDataset = datasetStore.getDatasetById(node.datasetId);
    targetDatasetNameForUpload.value = parentDataset ? parentDataset.label : node.datasetId;
    targetBasePathInDataset.value = node.path;
  } else {
    closeContextMenu();
    return;
  }
  addUrlDialogVisible.value = true;
  closeContextMenu();
};

const handleLocalFilesUploaded = () => {
  uploadLocalFilesDialogVisible.value = false;
  if (targetDatasetIdForUpload.value) {
      const currentSelection = uiStore.selectedExplorerItem;
      if (currentSelection && currentSelection.id === targetDatasetIdForUpload.value && currentSelection.type === 'dataset') {
          uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[targetDatasetIdForUpload.value] });
      } else if (currentSelection && currentSelection.datasetId === targetDatasetIdForUpload.value && currentSelection.type === 'folder' && currentSelection.path === targetBasePathInDataset.value) {
           uiStore.selectExplorerItem({ ...currentSelection });
      }
  }
};

const handleServerItemsAdded = () => {
  addServerItemsDialogVisible.value = false;
   if (targetDatasetIdForUpload.value) {
      const currentSelection = uiStore.selectedExplorerItem;
      if (currentSelection && currentSelection.id === targetDatasetIdForUpload.value && currentSelection.type === 'dataset') {
          uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[targetDatasetIdForUpload.value] });
      } else if (currentSelection && currentSelection.datasetId === targetDatasetIdForUpload.value && currentSelection.type === 'folder' && currentSelection.path === targetBasePathInDataset.value) {
           uiStore.selectExplorerItem({ ...currentSelection });
      }
  }
};

const handleAddUrlFileAdded = () => {
  addUrlDialogVisible.value = false;
  if (targetDatasetIdForUpload.value) {
      const currentSelection = uiStore.selectedExplorerItem;
      if (currentSelection && currentSelection.id === targetDatasetIdForUpload.value && currentSelection.type === 'dataset') {
          uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[targetDatasetIdForUpload.value] });
      } else if (currentSelection && currentSelection.datasetId === targetDatasetIdForUpload.value && currentSelection.type === 'folder' && currentSelection.path === targetBasePathInDataset.value) {
           uiStore.selectExplorerItem({ ...currentSelection });
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
            source: '本地',
            uniqueId: `local-${file.name}-${file.size}-${result.fileId || Date.now()}` 
        });
        ElMessage.success(`本地文件 ${file.name} 处理成功。`);
        localFileDisplayList.value = localFileDisplayList.value.filter(f => f.uid !== file.uid);
    } catch (error) {
        console.error('Error processing local file:', error);
        ElMessage.error(`处理本地文件 ${file.name} 失败: ${error.message || '未知错误'}`);
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
                source: '本地 (文件夹)',
                uniqueId: `local-folder-${file.webkitRelativePath || file.name}-${result.fileId || Date.now()}`
            });
            successCount++;
        } catch (error) {
            console.error(`Error processing folder file ${file.name}:`, error);
            ElMessage.error(`处理文件夹内文件 ${file.name} 失败: ${error.message || '未知错误'}`);
        }
    }
    if (successCount > 0) ElMessage.success(`${successCount}个文件夹内文件已处理。`);
    if (successCount !== filesToProcess.length) ElMessage.warning("部分文件夹内文件处理失败。");
    
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
                    source: 'URL',
                    uniqueId: `url-${result.fileId || urlFetchForm.value.fileName}` 
                });
                ElMessage.success(`URL文件 ${urlFetchForm.value.fileName} 处理成功。`);
                urlFetchFormRef.value.resetFields();
            } catch (error) {
                console.error('Error fetching URL file:', error);
                ElMessage.error(`抓取URL文件失败: ${error.message || '未知错误'}`);
            } finally {
                isProcessingUrlFile.value = false;
            }
        } else {
            ElMessage.error('请检查URL抓取表单输入。');
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
  if (allSelectedFilesForNewDataset.value.length === 0) {
    ElMessage.warning('请至少选择一个文件来创建数据集。'); return;
  }
  
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
  if (processedFilesForDialog.value.length === 0) { 
      ElMessage.error("未能准备任何文件，无法创建数据集。");
      return;
  }
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
.explorer-panel { height: 100%; display: flex; flex-direction: column; background-color: #252526; color: #cccccc;}
.collapse-title-text { flex-grow: 1; }
.collapse-header-action-btn { margin-left: auto; padding-right: 10px; }
.collapse-header-action-btn .el-icon { margin-right: 4px; }

.local-file-source-tab { padding: 10px; }
.local-file-uploader :deep(.el-upload-dragger) { padding: 20px 10px; }
.local-file-uploader :deep(.el-icon--upload) { font-size: 40px; margin-bottom: 10px; }
.local-file-uploader :deep(.el-upload__text) { font-size: 13px; }
.url-fetch-source-tab { padding: 15px; }
.selected-files-panel-for-new-dataset { margin-top: 15px; padding: 10px; background-color: #2c2c2d; border-radius: 4px;}
.selected-files-panel-for-new-dataset h4 { margin-top: 0; margin-bottom: 8px; font-size: 13px; color: #a0a0a0;}
.selected-files-panel-for-new-dataset :deep(.el-table th) { background-color: #2c2c2d !important; color: #a0a0a0 !important; font-weight: normal;}
.selected-files-panel-for-new-dataset :deep(.el-table td, .el-table th) { padding: 3px 0; font-size: 12px;}
.selected-files-panel-for-new-dataset :deep(.el-button--small) { padding: 2px 5px;}
.create-dataset-action-panel { padding: 0px 10px 10px 10px;}

.explorer-panel :deep(.el-collapse-item__header) { 
    background-color: #2c2c2d; 
    color: #cccccc; 
    border-bottom: 1px solid #333333; 
    padding-left: 10px; 
    font-size: 14px;
    display: flex;
    align-items: center;
}
.explorer-panel :deep(.el-collapse-item__wrap) { background-color: #252526; border-bottom: none;}
.explorer-panel :deep(.el-collapse-item__content) { padding: 0; color: #cccccc;}
.explorer-panel :deep(.el-tabs__header) { margin-bottom: 0px; }
.explorer-panel :deep(.el-tabs__nav-wrap) { padding: 0 10px; }
.explorer-panel :deep(.el-tabs__nav-wrap::after) { background-color: #333333; height: 1px; }
.explorer-panel :deep(.el-tabs__item) { color: #a0a0a0; font-size: 13px; padding: 0 10px; height: 35px; line-height: 35px; }
.explorer-panel :deep(.el-tabs__item.is-active) { color: #ffffff; }
.server-file-browser { font-size: 13px; padding: 8px 10px; }
.path-selector { margin-bottom: 8px; }
.path-selector :deep(.el-select) { width: 100%; }
.path-navigation { margin-bottom: 8px; padding: 6px; background: #2c2c2d; border-radius: 3px; font-size: 12px; }
.path-navigation :deep(.el-breadcrumb__item .el-breadcrumb__inner) { color: #b0b0b0 !important; cursor: pointer; }
.path-navigation :deep(.el-breadcrumb__item .el-breadcrumb__inner:hover) { color: #79bbff !important; }
.path-navigation :deep(.el-breadcrumb__separator) { color: #707070 !important; }
.file-name { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; }
.file-name span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-name:hover { color: #79bbff; }
.dataset-loading-indicator, .dataset-error-message { padding: 10px; font-size: 13px; text-align: center; }
.dataset-loading-indicator .progress-text { font-size: 12px; color: #a0a0a0; margin-top: 5px; }
.dataset-error-message { color: #f56c6c; }
.explorer-panel :deep(.dataset-tree) { background-color: transparent; color: #cccccc; font-size: 13px; padding: 5px 0; }
.explorer-panel :deep(.dataset-tree .el-tree-node__content) { height: 28px; padding-right: 10px; background-color: transparent !important; }
.explorer-panel :deep(.dataset-tree .el-tree-node__content:hover) { background-color: #303031 !important; }
.explorer-panel :deep(.dataset-tree .el-tree-node:focus > .el-tree-node__content) { background-color: #353536 !important; }
.explorer-panel :deep(.dataset-tree .el-tree-node.is-current > .el-tree-node__content) { background-color: #383839 !important; }
.explorer-panel :deep(.dataset-tree .el-tree-node__label) { color: #cccccc; }
.explorer-panel :deep(.dataset-tree .el-tree-node.is-current > .el-tree-node__content .el-tree-node__label) { color: #ffffff; }
.explorer-panel :deep(.el-tree__empty-text) { color: #a0a0a0; font-size: 13px; text-align: center; padding: 10px; }
.tree-node-custom { display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 13px; }
.node-label { display: flex; align-items: center; overflow: hidden; }
.node-text { margin-left: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dataset-icon-wrapper .el-icon, .folder-icon-wrapper .el-icon, .file-icon-wrapper .el-icon { font-size: 14px; vertical-align: middle; }
.file-icon-wrapper svg { width: 1em; height: 1em; font-size: 14px; }
.dataset-icon-wrapper .el-icon { color: #ffd700; } 
.folder-icon-wrapper .el-icon { color: #85c1e9; } 
.node-actions { display: none; margin-left: 8px; }
.explorer-panel :deep(.el-tree-node__content:hover .node-actions) { display: inline-block; }
.delete-dataset-btn .el-icon { font-size: 14px; }
.delete-dataset-btn:hover .el-icon { color: #f56c6c; }
.file-meta-info { font-size: 11px; color: #888888; margin-left: 8px; white-space: nowrap; }
.explorer-panel :deep(.el-table td), .explorer-panel :deep(.el-table th) { padding: 4px 0; }
.explorer-panel :deep(.file-table-row) { background-color: #252526 !important; color: #cccccc; }
.explorer-panel :deep(.file-table-row:hover > td) { background-color: #303031 !important; }
.explorer-panel :deep(.el-table__empty-text) { color: #a0a0a0; }
.explorer-panel :deep(.el-skeleton__item) { background-color: #3a3a3a; }
.empty-state, .loading-state { margin-top: 10px; padding: 10px; }
.explorer-panel :deep(.el-empty__description) { color: #a0a0a0; font-size: 13px; }
.explorer-panel .el-icon { color: #c0c4cc; }
.placeholder-tab-content { padding: 20px; text-align: center; color: #777; font-size: 13px; }

.custom-context-menu {
  position: fixed;
  background-color: #2c2c2d;
  border: 1px solid #444444;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.3);
  padding: 5px 0;
  z-index: 3000; 
  color: #cccccc;
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
  background-color: #383839;
}
</style>

[end of src/components/ExplorerPanel.vue]

[start of src/components/DatasetNodeDisplay.vue]
<template>
  <div class="dataset-node-display-item" :class="`node-type-${node.type}`">
    <div class="node-content">
      <span class="node-label" @click="handleNodeClick" :title="node.path">
        <el-icon v-if="node.type === 'folder'" class="folder-icon">
          <FolderOpened v-if="isExpanded" />
          <Folder v-else />
        </el-icon>
        <span v-else-if="node.type === 'file'" class="file-icon-wrapper" :style="{ color: getFileIconColor(node.label, node.fileContentType) }">
          <svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align: middle;">
            <path fill="currentColor" :d="getFileIconPath(node.label, node.fileContentType)" />
          </svg>
        </span>
        <span class="node-text">{{ node.label }}</span>
      </span>
      <span class="node-actions">
        <el-tooltip v-if="node.type === 'file'" content="从数据集中移除此文件" placement="top">
          <el-button link type="danger" size="small" @click.stop="confirmRemoveFile" title="移除文件">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        <span v-if="node.type === 'file' && node.fileSize !== undefined" class="file-size-info">
          {{ formatFileSize(node.fileSize) }}
        </span>
      </span>
    </div>
    <div v-if="node.type === 'folder' && node.children && node.children.length > 0 && isExpanded" class="node-children">
      <DatasetNodeDisplay
        v-for="childNode in node.children"
        :key="childNode.id"
        :node="childNode"
        :dataset-id="datasetId"
        :current-dataset-details="currentDatasetDetails"
        @file-click="$emit('file-click', $event)"
        @folder-click="$emit('folder-click', $event)"
        @remove-file="$emit('remove-file', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import { ElIcon, ElButton, ElTooltip } from 'element-plus';
import { Folder, FolderOpened, Delete } from '@element-plus/icons-vue';
import { getFileIconPath, getFileIconColor, formatFileSize } from '@/utils/fileDisplayUtils';
import { useUIStore } from '@/stores/uiStore';

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  datasetId: { 
    type: [String, Number],
    required: true,
  },
  currentDatasetDetails: { 
    type: Object,
    required: true,
  }
});

const emit = defineEmits(['file-click', 'folder-click', 'remove-file']);

const uiStore = useUIStore();
const isExpanded = ref(props.node.type === 'folder' ? true : false); 

const handleNodeClick = () => {
  if (props.node.type === 'file') {
    emit('file-click', { ...props.node, datasetId: props.datasetId });
    uiStore.selectExplorerItem({ ...props.node, datasetId: props.datasetId });
  } else if (props.node.type === 'folder') {
    isExpanded.value = !isExpanded.value;
    emit('folder-click', { ...props.node, datasetId: props.datasetId });
    uiStore.selectExplorerItem({ ...props.node, datasetId: props.datasetId });
  }
};

const confirmRemoveFile = () => {
  if (props.node.type !== 'file') return;
  // currentDatasetDetails is passed to provide the full dataset context for the removal action
  emit('remove-file', { fileNode: props.node, dataset: props.currentDatasetDetails });
};

</script>

<style scoped>
.dataset-node-display-item {
  padding: 2px 0px 2px 10px; 
  font-size: 14px;
  line-height: 24px;
}

.node-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: default; 
}
.node-content:hover {
  background-color: #383839; 
}

.node-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer; 
  flex-grow: 1;
  overflow: hidden;
}
.node-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.folder-icon, .file-icon-wrapper {
  font-size: 16px;
  color: #85c1e9; 
}
.file-icon-wrapper svg {
  width: 1em;
  height: 1em;
  font-size: 16px; 
}
.node-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 10px; 
}
.node-actions .el-button--small {
  padding: 2px 4px;
}
.node-actions .el-icon {
  font-size: 14px;
}
.file-size-info {
  font-size: 0.8em;
  color: #888888;
  white-space: nowrap;
}

.node-children {
  margin-left: 20px; 
  border-left: 1px dashed #444; 
}
</style>
[end of src/components/DatasetNodeDisplay.vue]
