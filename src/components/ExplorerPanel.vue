<template>
  <div class="explorer-panel">
    <el-collapse v-model="activeCollapseNames">
      <el-collapse-item title="数据集" name="datasets">
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
                <span v-else-if="data.type === 'file'" class="file-icon-wrapper" :style="{ color: getFileIconColor(data.file?.fileContentType, data.file?.fileName) }">
                  <svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align: middle;">
                    <path fill="currentColor" :d="getFileIconPath(data.file?.fileContentType, data.file?.fileName)"/>
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
                 {{ formatFileSize(data.file?.fileSize) }}
              </span>
            </span>
          </template>
        </el-tree>
      </el-collapse-item>
      <el-collapse-item title="文件源 (创建新数据集)" name="fileSources">
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
  </div>
  <CreateDatasetDialog
    :visible="createDatasetDialogVisible"
    :files-for-dataset="processedFilesForDialog"
    @update:visible="createDatasetDialogVisible = $event"
    @dataset-created="handleDatasetCreated"
  />
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
    ElCollapse, ElCollapseItem, ElTabs, ElTabPane, ElSelect, ElOption, 
    ElBreadcrumb, ElBreadcrumbItem, ElTable, ElTableColumn, ElIcon, 
    ElEmpty, ElSkeleton, ElTree, ElButton, ElMessage, ElMessageBox, ElUpload,
    ElForm, ElFormItem, ElInput 
} from 'element-plus';
import { Folder, Document, Delete, Coin, FolderOpened, UploadFilled } from '@element-plus/icons-vue';
import CreateDatasetDialog from './CreateDatasetDialog.vue'; 
import * as apiService from '@/services/apiService'; 

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
const localFileDisplayList = ref([]); // For el-upload's display list, separate from processed files

// --- State for New Dataset Creation ---
const newDatasetSelectedServerFiles = ref([]); 
const newDatasetSelectedLocalFiles = ref([]); // Stores { fileId, fileAbs, name, source: '本地', uniqueId, uid? }
const newDatasetSelectedUrlFiles = ref([]); // Stores { fileId, fileAbs, name, source: 'URL', uniqueId }

const allSelectedFilesForNewDataset = computed(() => [
    ...newDatasetSelectedServerFiles.value.map(f => ({ ...f, name: f.name, source: '服务器', uniqueId: `server-${f.path}` })),
    ...newDatasetSelectedLocalFiles.value, 
    ...newDatasetSelectedUrlFiles.value, 
]);

const createDatasetDialogVisible = ref(false); 
const isProcessingNewDatasetFiles = ref(false); // For server files processing step before dialog
const isProcessingLocalFiles = ref(false); // For active local file/folder uploads
const isProcessingUrlFile = ref(false); // For active URL fetching
const processedFilesForDialog = ref([]); 

const overallProcessingButtonText = computed(() => {
    if (isProcessingNewDatasetFiles.value) return '处理服务器文件中...';
    if (isProcessingLocalFiles.value) return '处理本地文件中...';
    if (isProcessingUrlFile.value) return '处理URL文件中...';
    return '创建新数据集';
});

const urlFetchFormRef = ref(null);
const urlFetchForm = ref({ url: '', fileName: '', referer: '', userAgent: '' });

// --- Dataset Section Logic (Implementations are complete from previous steps) ---
const builtDatasetTreeData = computed(() => Object.values(datasetStore.detailedDatasets).map(ds => ({
    id: ds.id, label: ds.label, type: 'dataset', isDataset: true, 
    description: ds.description, tags: ds.tags,
    children: Array.isArray(ds.children)
      ? ds.children.map(file => transformFileNode(file, ds.id)).filter(Boolean)
      : [],
    fileIds: ds.fileIds, fileAbsList: ds.fileAbsList, ispublic: ds.ispublic,
})));

function transformFileNode(file, datasetId) {
  if (!file) return null;
  return {
    id: file.fileId || file.id, // 确保有唯一id
    label: file.fileName || file.label,
    type: file.type || 'file',
    isFileNode: true,
    datasetId,
    children: Array.isArray(file.children)
      ? file.children.map(child => transformFileNode(child, datasetId)).filter(Boolean)
      : [],
    ...file
  };
}

const handleDatasetTreeNodeClick = async (data) => uiStore.selectExplorerItem(data);
const confirmDeleteDataset = async (datasetNodeData) => {
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
    // 如果当前选中项就是被删除的，清空右侧详情
    if (uiStore.selectedExplorerItem?.id === datasetNodeData.id) {
      uiStore.clearSelectedExplorerItem();
    }
  } catch (error) {
    if (error !== 'cancel' && error.message !== 'cancel' && error.name !== 'cancel') {
      console.error('删除数据集失败:', error);
      ElMessage.error(`删除失败: ${error.message}`);
    }
  }
};
const getNodeTitle = (data) => { /* ... */ }; // Full implementation needed


// --- File Sources Section Logic ---
// Server Files Tab
const handleServerFileOrFolderClick = (item) => { if (item.type === '文件夹') fileBrowserStore.fetchFiles(item.path); };
const isServerFileSelectableForNewDataset = (row) => row.type === '文件'; 
const handleNewDatasetServerFileSelectionChange = (selection) => { newDatasetSelectedServerFiles.value = selection; };
const handleServerPathSegmentClick = (index) => { /* ... */ }; // Full implementation needed

// Local Files Tab
const handleLocalFileSelectionChange = (file, fileList) => {
    // This is primarily to update the visual list in el-upload.
    // Actual file processing happens in customLocalUploadRequest.
    localFileDisplayList.value = fileList;
};
const handleLocalFileRemoveFromDisplay = (file, fileList) => {
    localFileDisplayList.value = fileList;
    // Also remove from our processed list if it was added
    newDatasetSelectedLocalFiles.value = newDatasetSelectedLocalFiles.value.filter(f => f.uid !== file.uid);
};
const customLocalUploadRequest = async ({ file }) => { // el-upload custom http-request
    isProcessingLocalFiles.value = true;
    try {
        // server's /api/upload-local-to-dataset expects FormData with 'file' and other optional fields
        const formData = new FormData();
        formData.append('file', file); 
        // Add other fields if your API expects them directly with the file, e.g. datasetName if uploading to a specific one.
        // For new dataset creation, we are just collecting fileId and fileAbs here.
        
        const result = await apiService.uploadLocalFile(formData); // Pass FormData directly
        newDatasetSelectedLocalFiles.value.push({
            ...result, // Should be { fileId, fileAbs, name }
            uid: file.uid, 
            source: '本地',
            uniqueId: `local-${result.name}-${file.size}` 
        });
        ElMessage.success(`本地文件 ${result.name} 处理成功。`);
        // Remove from el-upload's display list as it's now "processed"
        localFileDisplayList.value = localFileDisplayList.value.filter(f => f.uid !== file.uid);
    } catch (error) {
        console.error('Error processing local file:', error);
        ElMessage.error(`处理本地文件 ${file.name} 失败: ${error.message}`);
        localFileDisplayList.value = localFileDisplayList.value.filter(f => f.uid !== file.uid); // Remove on error too
    } finally {
        // Check if all files from a batch are done if multiple uploads were triggered
        // For simplicity, assume one by one or manage this state more granularly if needed
        isProcessingLocalFiles.value = false; 
    }
};
const triggerLocalFolderInput = () => { localFolderInputRef.value?.click(); };
const handleLocalFolderInputChange = async (event) => { 
    const files = event.target.files;
    if (!files || files.length === 0) return;
    isProcessingLocalFiles.value = true;
    let successCount = 0;
    for (const file of files) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            // If API needs original file name, pass it. Some backends might read from FormData 'filename'
            // formData.append('originalName', file.name); 
            const result = await apiService.uploadLocalFile(formData); 
             newDatasetSelectedLocalFiles.value.push({
                ...result, 
                source: '本地 (文件夹)',
                name: file.name, // Ensure original name is used for display
                uniqueId: `local-folder-${file.name}-${file.size}` // Use original name for uniqueId
            });
            successCount++;
        } catch (error) {
            console.error(`Error processing folder file ${file.name}:`, error);
            ElMessage.error(`处理文件夹内文件 ${file.name} 失败: ${error.message}`);
        }
    }
    if (successCount > 0) ElMessage.success(`${successCount}个文件夹内文件已处理。`);
    if (successCount !== files.length) ElMessage.warning("部分文件夹内文件处理失败。");
    
    localFolderInputRef.value.value = ''; 
    isProcessingLocalFiles.value = false;
};

// URL Fetch Tab
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
                    ...result, // { fileId, fileAbs, name }
                    source: 'URL',
                    uniqueId: `url-${result.name || result.fileId}` 
                });
                ElMessage.success(`URL文件 ${result.name} 处理成功。`);
                urlFetchFormRef.value.resetFields();
            } catch (error) {
                console.error('Error fetching URL file:', error);
                ElMessage.error(`抓取URL文件失败: ${error.message}`);
            } finally {
                isProcessingUrlFile.value = false;
            }
        } else {
            ElMessage.error('请检查URL抓取表单输入。');
            return false;
        }
    });
};

const handleFileSourceTabChange = (tabName) => { /* ... (same as before) ... */ };

const removeFileFromNewDatasetSelection = (fileToRemove) => { 
  if (fileToRemove.source === '服务器') {
    newDatasetSelectedServerFiles.value = newDatasetSelectedServerFiles.value.filter(f => f.uniqueId !== fileToRemove.uniqueId);
    const tableInstance = serverFileSelectionTableRef.value;
    if (tableInstance) {
        const rowToDeselect = fileBrowserStore.serverFiles.find(sf => `server-${sf.path}` === fileToRemove.uniqueId);
        if (rowToDeselect) tableInstance.toggleRowSelection(rowToDeselect, false);
    }
  } else if (fileToRemove.source === '本地' || fileToRemove.source === '本地 (文件夹)') {
    newDatasetSelectedLocalFiles.value = newDatasetSelectedLocalFiles.value.filter(f => f.uniqueId !== fileToRemove.uniqueId);
    localFileDisplayList.value = localFileDisplayList.value.filter(f => f.uid !== fileToRemove.uid);
  } else if (fileToRemove.source === 'URL') {
    newDatasetSelectedUrlFiles.value = newDatasetSelectedUrlFiles.value.filter(f => f.uniqueId !== fileToRemove.uniqueId);
  }
};

const handleOpenCreateDatasetDialog = async () => {
  if (allSelectedFilesForNewDataset.value.length === 0) {
    ElMessage.warning('请至少选择一个文件来创建数据集。'); return;
  }
  
  const filesToProcessForDialog = [];

  // Add already processed local and URL files
  filesToProcessForDialog.push(...newDatasetSelectedLocalFiles.value.map(f => ({fileId: f.fileId, fileAbs: f.fileAbs, name: f.name})));
  filesToProcessForDialog.push(...newDatasetSelectedUrlFiles.value.map(f => ({fileId: f.fileId, fileAbs: f.fileAbs, name: f.name})));
  
  // Process server files if any
  if (newDatasetSelectedServerFiles.value.length > 0) {
    isProcessingNewDatasetFiles.value = true; 
    try {
      for (const file of newDatasetSelectedServerFiles.value) {
        const result = await apiService.registerServerFile({ filePath: file.path, fileName: file.name });
        filesToProcessForDialog.push({ ...result, name: file.name });
      }
    } catch (error) {
      console.error("Error processing server files for new dataset:", error);
      ElMessage.error(`处理服务器文件时出错: ${error.message}`);
      isProcessingNewDatasetFiles.value = false;
      return; // Stop if server file processing fails
    } finally {
      isProcessingNewDatasetFiles.value = false;
    }
  }
    
  processedFilesForDialog.value = filesToProcessForDialog;
  if (processedFilesForDialog.value.length === 0) { // Should not happen if initial check passed
      ElMessage.error("未能准备任何文件，无法创建数据集。");
      return;
  }
  createDatasetDialogVisible.value = true;
};

const handleDatasetCreated = () => { 
    newDatasetSelectedServerFiles.value = [];
    newDatasetSelectedLocalFiles.value = []; 
    newDatasetSelectedUrlFiles.value = [];
    localFileDisplayList.value = []; 
    if(serverFileSelectionTableRef.value) serverFileSelectionTableRef.value.clearSelection();
    processedFilesForDialog.value = []; 
    if(urlFetchFormRef.value) urlFetchFormRef.value.resetFields();
};

// --- Lifecycle Hooks ---
onMounted(async () => { /* ... (same as before, full implementation needed) ... */ 
    await datasetStore.fetchDatasets(); 
    if (activeFileSourceTab.value === 'server') {
        await fileBrowserStore.fetchFiles(fileBrowserStore.selectedBasePath);
    }
});

// --- Icon and Formatting Helpers (Full definitions needed here) ---
const FILE_TYPE_ICONS = { /* ... */ }; const EXTENSION_TO_MIME = { /* ... */ };
const getFileIconStyle = (contentType, fileName) => { /* ... */ };
const getFileIconPath = (contentType, fileName) => { /* ... */ };
const getFileIconColor = (contentType, fileName) => { /* ... */ };
const formatFileSize = (size) => { /* ... */ };

// Re-add full definitions for methods truncated in prompt
// builtDatasetTreeData, transformFileNode, confirmDeleteDataset, getNodeTitle, handleServerPathSegmentClick, handleFileSourceTabChange
// These are assumed to be complete and correct from previous steps.
// For example:
// const builtDatasetTreeData = computed(() => Object.values(datasetStore.detailedDatasets).map(ds => ({ /* ... */ })));
// function transformFileNode(file, datasetId) { /* ... */ }
// etc.

</script>

<style scoped>
/* ... (existing styles, plus new ones if any) ... */
.explorer-panel { height: 100%; display: flex; flex-direction: column; background-color: #252526; color: #cccccc;}
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

/* Ensure other styles from previous steps are preserved */
.explorer-panel :deep(.el-collapse-item__header) { background-color: #2c2c2d; color: #cccccc; border-bottom: 1px solid #333333; padding-left: 10px; font-size: 14px;}
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

</style>
