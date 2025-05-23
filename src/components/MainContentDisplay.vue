<template>
  <div class="main-content-display" :class="{ 'dark-theme': true }">
    <el-card v-if="selectedItem" class="details-card">
      <template #header>
        <div class="card-header">
          <span class="header-title-text">
            <span v-if="selectedItem.type === 'dataset'">数据集详情: {{ selectedItem.label }}</span>
            <span v-else-if="selectedItem.type === 'file'">文件详情: {{ selectedItem.label }}</span>
            <span v-else-if="selectedItem.type === 'folder'">文件夹详情: {{ selectedItem.label }}</span>
            <span v-else-if="selectedItem.type === 'server-file'">服务器文件: {{ selectedItem.name }}</span>
          </span>
          <div>
            <el-button
              v-if="selectedItem.type === 'dataset'"
              type="primary"
              link
              size="small"
              @click="openEditDatasetDialog"
              class="edit-button"
              title="编辑详情"
            >
              <el-icon><Edit /></el-icon> 编辑
            </el-button>
            <el-button
              v-if="selectedItem.type === 'dataset'"
              type="success"
              link
              size="small"
              @click="openAddFilesToDatasetDialog"
              class="add-files-button"
              title="添加文件到此数据集"
            >
              <el-icon><Plus /></el-icon> 添加文件
            </el-button>
          </div>
        </div>
      </template>

      <!-- Dataset Details -->
      <div v-if="selectedItem.type === 'dataset' && currentDatasetDetails" class="dataset-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="Dataset ID">{{ currentDatasetDetails.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ currentDatasetDetails.label }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ currentDatasetDetails.description || '无' }}</el-descriptions-item>
          <el-descriptions-item label="标签">
            <span v-if="currentDatasetDetails.tags && currentDatasetDetails.tags.length > 0">
              <el-tag v-for="tag in currentDatasetDetails.tags" :key="tag" size="small" class="detail-tag">{{ tag }}</el-tag>
            </span>
            <span v-else>无</span>
          </el-descriptions-item>
        </el-descriptions>
        <h4 v-if="currentDatasetDetails.children && currentDatasetDetails.children.length > 0" class="section-title">包含的文件/文件夹:</h4>
        <div v-if="currentDatasetDetails.children && currentDatasetDetails.children.length > 0" class="item-children-container">
          <DatasetNodeDisplay
            v-for="childNode in currentDatasetDetails.children"
            :key="childNode.id"
            :node="childNode"
            :dataset-id="currentDatasetDetails.id"
            :current-dataset-details="currentDatasetDetails"
            @remove-file="handleRemoveFileEvent"
            @file-click="handleFileNodeClick"
            @folder-click="handleFolderNodeClick"
          />
        </div>
         <p v-else class="empty-message">此数据集为空。</p>
      </div>

      <!-- File Details (from dataset) -->
      <div v-if="selectedItem.type === 'file'" class="file-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="File ID">{{ selectedItem.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ selectedItem.label }}</el-descriptions-item>
          <el-descriptions-item label="所属数据集 ID">{{ selectedItem.datasetId }}</el-descriptions-item>
          <el-descriptions-item label="路径 (FileAbs)">{{ selectedItem.path }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ selectedItem.fileContentType || selectedItem.file?.fileContentType || '未知' }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ formatFileSize(selectedItem.fileSize ?? selectedItem.file?.fileSize) }}</el-descriptions-item>
        </el-descriptions>
        <el-button type="primary" size="small" style="margin-top: 15px;" @click="handleDownloadFile">下载</el-button>
      </div>

      <!-- Folder Details (from dataset) -->
      <div v-if="selectedItem.type === 'folder'" class="folder-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="Node ID">{{ selectedItem.id }}</el-descriptions-item> {/* This is the generated ID for the tree */}
          <el-descriptions-item label="名称">{{ selectedItem.label }}</el-descriptions-item>
          <el-descriptions-item label="所属数据集 ID">{{ selectedItem.datasetId }}</el-descriptions-item>
          <el-descriptions-item label="路径">{{ selectedItem.path }}</el-descriptions-item>
        </el-descriptions>
        <h4 v-if="selectedItem.children && selectedItem.children.length > 0" class="section-title">包含的文件/文件夹:</h4>
        <div v-if="selectedItem.children && selectedItem.children.length > 0" class="item-children-container">
          <DatasetNodeDisplay
            v-for="childNode in selectedItem.children"
            :key="childNode.id"
            :node="childNode"
            :dataset-id="selectedItem.datasetId" 
            :current-dataset-details="datasetStore.detailedDatasets[selectedItem.datasetId]"
            @remove-file="handleRemoveFileEvent"
            @file-click="handleFileNodeClick"
            @folder-click="handleFolderNodeClick"
          />
        </div>
        <p v-else class="empty-message">此文件夹为空。</p>
      </div>
      
      <!-- Server File Details -->
      <div v-if="selectedItem.type === 'server-file'" class="server-file-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="名称">{{ selectedItem.name }}</el-descriptions-item>
          <el-descriptions-item label="完整路径">{{ selectedItem.path }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ formatFileSize(selectedItem.size) }}</el-descriptions-item>
        </el-descriptions>
      </div>

    </el-card>
    <el-empty v-else description="请在左侧选择一个项目以查看详情" class="empty-state-custom" />

    <EditDatasetDialog
      v-if="editDialogDatasetId"
      :visible="editDatasetDialogVisible"
      :dataset-id="editDialogDatasetId"
      @update:visible="editDatasetDialogVisible = $event"
      @dataset-updated="handleDialogDatasetUpdated"
    />

    <AddFilesDialog
      v-if="addFilesDialogDatasetId"
      :visible="addFilesDialogVisible"
      :dataset-id="addFilesDialogDatasetId" 
      @update:visible="addFilesDialogVisible = $event"
      @files-added="handleDialogFilesAdded" 
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElCard, ElDescriptions, ElDescriptionsItem, ElTag, ElButton, ElEmpty, ElIcon, ElMessageBox, ElMessage } from 'element-plus';
import { Folder, Document, Edit, Delete, Plus } from '@element-plus/icons-vue';
import EditDatasetDialog from './EditDatasetDialog.vue';
import AddFilesDialog from './AddFilesDialog.vue';
import DatasetNodeDisplay from './DatasetNodeDisplay.vue'; 
import { useUIStore } from '@/stores/uiStore';
import { useDatasetStore } from '@/stores/datasetStore';
import * as apiService from '@/services/apiService';
// Assuming formatFileSize might be moved to utils, but if it's local:
// import { formatFileSize } from '@/utils/fileDisplayUtils'; // Or keep local if not moved

const uiStore = useUIStore();
const datasetStore = useDatasetStore();

const selectedItem = computed(() => uiStore.selectedExplorerItem);

const editDatasetDialogVisible = ref(false);
const editDialogDatasetId = ref(null);

const addFilesDialogVisible = ref(false); // For the original "Add Files" button if it uses AddFilesDialog
const addFilesDialogDatasetId = ref(null);


const currentDatasetDetails = computed(() => {
    if (selectedItem.value && selectedItem.value.type === 'dataset' && selectedItem.value.id) {
        return datasetStore.detailedDatasets[selectedItem.value.id];
    }
    return null;
});

watch(selectedItem, async (newItem) => {
    if (newItem && newItem.type === 'dataset' && newItem.id) {
        const detail = datasetStore.detailedDatasets[newItem.id];
        if (!detail || !detail.children || !detail.flatFileList) {
            await datasetStore.fetchDatasetDetails(newItem.id, true); 
        }
    } else if (newItem && newItem.type === 'folder' && newItem.datasetId) {
        const parentDatasetDetail = datasetStore.detailedDatasets[newItem.datasetId];
        if (!parentDatasetDetail || !parentDatasetDetail.children || !parentDatasetDetail.flatFileList) {
            await datasetStore.fetchDatasetDetails(newItem.datasetId, true);
        }
    }
}, { immediate: true });


const openEditDatasetDialog = () => {
  if (selectedItem.value && selectedItem.value.type === 'dataset') {
    editDialogDatasetId.value = selectedItem.value.id;
    editDatasetDialogVisible.value = true;
  }
};

// This function is for the original "Add Files" button on a dataset
const openAddFilesToDatasetDialog = () => {
  if (selectedItem.value && selectedItem.value.type === 'dataset') {
    addFilesDialogDatasetId.value = selectedItem.value.id;
    // We might need to pass the dataset name and base path if AddFilesDialog expects them
    // For now, assuming AddFilesDialog fetches name with datasetId
    addFilesDialogVisible.value = true; 
  }
};

const handleDialogDatasetUpdated = () => {
  if(editDialogDatasetId.value && datasetStore.detailedDatasets[editDialogDatasetId.value]) {
      const updatedDatasetNodeData = datasetStore.detailedDatasets[editDialogDatasetId.value];
       uiStore.selectExplorerItem({ 
        ...updatedDatasetNodeData 
      });
  }
};

// This handles the @files-added event from the original AddFilesDialog (if used by the button)
const handleDialogFilesAdded = () => {
  if (addFilesDialogDatasetId.value && datasetStore.detailedDatasets[addFilesDialogDatasetId.value]) {
    uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[addFilesDialogDatasetId.value] });
  }
};

const formatFileSize = (size) => { // Keep local or import from utils
  if (size === undefined || size === null || Number.isNaN(size)) return '未知大小';
  if (size === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(size)) / Math.log(k)); // Use Math.abs for safety
  if (i < 0 || i >= sizes.length) return `${size} B`;
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const confirmRemoveFileFromDataset = async (eventData) => {
  if (!eventData || !eventData.fileNode || !eventData.dataset) {
    ElMessage.error("无法确定要移除的文件或所属数据集。");
    return;
  }

  const { fileNode, dataset } = eventData;
  const datasetId = dataset.id;
  const fileId = fileNode.id; 
  const fileAbs = fileNode.path; 

  if (!fileId) {
    ElMessage.error("文件ID未知，无法移除。");
    return;
  }
  if (!datasetId) {
    ElMessage.error("所属数据集ID未知，无法移除。");
    return;
  }
  
  const datasetLabel = dataset.label || datasetId;
  const fileLabel = fileNode.label || fileId;

  try {
    await ElMessageBox.confirm(
      `确定要从数据集 "${datasetLabel}" 中移除文件 "${fileLabel}" 吗？`,
      '移除文件确认',
      { confirmButtonText: '确定移除', cancelButtonText: '取消', type: 'warning', customClass: 'dark-message-box' }
    );
    
    await datasetStore.removeFileFromDataset({ datasetId, fileIdToRemove: fileId, fileAbsToRemove: fileAbs });
    ElMessage.success(`文件 "${fileLabel}" 已成功从数据集中移除。`);
    
    const currentSelectedItem = uiStore.selectedExplorerItem;
    if (currentSelectedItem && currentSelectedItem.id === datasetId && currentSelectedItem.type === 'dataset') {
        uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[datasetId] });
    } else if (currentSelectedItem && currentSelectedItem.type === 'folder' && currentSelectedItem.datasetId === datasetId) {
        await datasetStore.fetchDatasetDetails(datasetId, true); 
        const updatedParentDataset = datasetStore.detailedDatasets[datasetId];
        let updatedFolderNode = null;
        function findNodeById(nodes, id) {
            if (!nodes) return null;
            for (const node of nodes) {
                if (node.id === id) return node;
                if (node.children) {
                    const found = findNodeById(node.children, id);
                    if (found) return found;
                }
            }
            return null;
        }
        if (updatedParentDataset && updatedParentDataset.children) {
            updatedFolderNode = findNodeById(updatedParentDataset.children, currentSelectedItem.id);
        }
        if (updatedFolderNode) {
             uiStore.selectExplorerItem({ ...updatedFolderNode, datasetId: datasetId });
        } else {
            uiStore.selectExplorerItem({ ...updatedParentDataset });
        }
    }
    else if (currentSelectedItem && currentSelectedItem.id === fileId && currentSelectedItem.type === 'file') {
        uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[datasetId] });
    }

  } catch (error) {
    if (error !== 'cancel' && error.message !== 'cancel' && error.name !== 'cancel') { 
      console.error('移除文件失败:', error);
      ElMessage.error(`移除文件失败: ${error.message || '未知错误'}`);
    }
  }
};

const handleRemoveFileEvent = (eventData) => {
  confirmRemoveFileFromDataset(eventData);
};

const handleFileNodeClick = (fileNodeWithContext) => {
  // uiStore.selectExplorerItem is already called by DatasetNodeDisplay
};

const handleFolderNodeClick = (folderNodeWithContext) => {
  // uiStore.selectExplorerItem is already called by DatasetNodeDisplay
};

const downloadUrlCache = ref({});
const handleDownloadFile = async () => {
  if (!selectedItem.value || !selectedItem.value.datasetId || !selectedItem.value.id) {
    ElMessage.error('无法获取文件信息');
    return;
  }
  const cacheKey = `${selectedItem.value.datasetId}_${selectedItem.value.id}`;
  let url = downloadUrlCache.value[cacheKey];
  if (!url) {
    try {
      const res = await apiService.getFileDownloadUrl({
        datasetId: selectedItem.value.datasetId,
        fileId: selectedItem.value.id
      });
      url = res.url || res.downloadUrl || res;
      if (!url) throw new Error('未获取到下载链接');
      downloadUrlCache.value[cacheKey] = url;
    } catch (e) {
      ElMessage.error('获取下载链接失败: ' + (e.message || '未知错误'));
      return;
    }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = selectedItem.value.label || '';
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

</script>

<style scoped>
.main-content-display { padding: 0; height: 100%; overflow-y: auto; }
.dark-theme { background-color: #1e1e1e; color: #d4d4d4; }
.details-card { background-color: #252526; color: #d4d4d4; border: 1px solid #333333; box-shadow: none; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-title-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1; margin-right: 10px; }
.card-header > div { display: flex; align-items: center; flex-shrink: 0; }
.edit-button, .add-files-button { flex-shrink: 0; }
.edit-button .el-icon, .add-files-button .el-icon { margin-right: 4px; }
.edit-button { color: #79bbff; }
.edit-button:hover { color: #a0cfff; }
.add-files-button { color: #67c23a; margin-left: 8px; }
.add-files-button:hover { color: #95d475; }
.dark-theme :deep(.el-card__header) { color: #d4d4d4; border-bottom: 1px solid #333333; font-size: 16px; font-weight: 600; }
.dark-theme :deep(.el-descriptions__label) { color: #a8a8a8; background-color: #2c2c2d; }
.dark-theme :deep(.el-descriptions__content) { color: #d4d4d4; background-color: #252526; }
.dark-theme :deep(.el-descriptions__table), .dark-theme :deep(.el-descriptions__row) { border-color: #333333 !important; }
.dark-theme :deep(.el-descriptions--small .el-descriptions__label), .dark-theme :deep(.el-descriptions--small .el-descriptions__content) { padding: 6px 10px; }

.section-title { margin-top: 20px; margin-bottom: 10px; font-size: 14px; color: #c0c0c0; font-weight: 500; }
.item-children-container { 
  /* Optional: Add padding or border if desired for the container */
}
.empty-message { font-size: 13px; color: #777777; margin-top: 10px; padding-left: 10px; }


.detail-tag { margin-right: 5px; margin-bottom: 5px; background-color: #3a3a3a; border-color: #4a4a4a; color: #b0b0b0; }
.empty-state-custom { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.dark-theme :deep(.el-empty__description p) { color: #777777; }
.server-file-details { margin-top:10px; }
</style>
