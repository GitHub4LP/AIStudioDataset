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
          <el-descriptions-item label="ID">{{ currentDatasetDetails.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ currentDatasetDetails.label }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ currentDatasetDetails.description || '无' }}</el-descriptions-item>
          <el-descriptions-item label="标签">
            <span v-if="currentDatasetDetails.tags && currentDatasetDetails.tags.length > 0">
              <el-tag v-for="tag in currentDatasetDetails.tags" :key="tag" size="small" class="detail-tag">{{ tag }}</el-tag>
            </span>
            <span v-else>无</span>
          </el-descriptions-item>
        </el-descriptions>
        <h4 v-if="currentDatasetDetails.children && currentDatasetDetails.children.length > 0">包含的文件/文件夹:</h4>
        <ul v-if="currentDatasetDetails.children && currentDatasetDetails.children.length > 0" class="item-children-list">
          <li v-for="child in currentDatasetDetails.children" :key="child.id" class="child-item">
            <div class="child-info">
              <el-icon v-if="child.type === 'folder' || !child.isFileNode"><Folder /></el-icon>
              <el-icon v-else-if="child.type === 'file' || child.isFileNode"><Document /></el-icon>
              <span class="child-label">{{ child.label || child.fileName }}</span>
              <span class="child-type">({{ child.type || (child.isFileNode ? 'file' : 'folder') }})</span>
            </div>
            <el-button
              v-if="child.type === 'file' || child.isFileNode"
              link
              type="danger"
              size="small"
              @click="confirmRemoveFileFromDataset(child)"
              title="从数据集中移除此文件"
              class="remove-file-button"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </li>
        </ul>
         <p v-else>此数据集为空。</p>
      </div>

      <!-- File Details (from dataset) -->
      <div v-if="selectedItem.type === 'file'" class="file-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="ID">{{ selectedItem.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ selectedItem.label }}</el-descriptions-item>
          <el-descriptions-item label="所属数据集 ID">{{ selectedItem.datasetId }}</el-descriptions-item>
          <el-descriptions-item label="路径">{{ selectedItem.path }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ selectedItem.file?.fileContentType || '未知' }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ formatFileSize(selectedItem.file?.fileSize) }}</el-descriptions-item>
        </el-descriptions>
        <el-button type="primary" size="small" style="margin-top: 15px;" disabled>下载 (功能待实现)</el-button>
      </div>

      <!-- Folder Details (from dataset) -->
      <div v-if="selectedItem.type === 'folder'" class="folder-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="ID">{{ selectedItem.id }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ selectedItem.label }}</el-descriptions-item>
          <el-descriptions-item label="所属数据集 ID">{{ selectedItem.datasetId }}</el-descriptions-item>
          <el-descriptions-item label="路径">{{ selectedItem.path }}</el-descriptions-item>
        </el-descriptions>
         <h4 v-if="selectedItem.children && selectedItem.children.length > 0">包含的文件/文件夹:</h4>
        <ul v-if="selectedItem.children && selectedItem.children.length > 0" class="item-children-list">
           <li v-for="child in selectedItem.children" :key="child.id" class="child-item">
             <el-icon v-if="child.type === 'folder' || !child.isFileNode"><Folder /></el-icon>
             <el-icon v-else-if="child.type === 'file' || child.isFileNode"><Document /></el-icon>
             {{ child.label || child.fileName }} ({{ child.type || (child.isFileNode ? 'file' : 'folder') }})
          </li>
        </ul>
        <p v-else>此文件夹为空。</p>
      </div>
      
      <!-- Server File Details -->
      <div v-if="selectedItem.type === 'server-file'" class="server-file-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="名称">{{ selectedItem.name }}</el-descriptions-item>
          <el-descriptions-item label="完整路径">{{ selectedItem.path }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ formatFileSize(selectedItem.size) }}</el-descriptions-item>
        </el-descriptions>
         <!-- Add actions for server files if any, e.g., add to new dataset -->
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
import { useUIStore } from '@/stores/uiStore';
import { useDatasetStore } from '@/stores/datasetStore';

const uiStore = useUIStore();
const datasetStore = useDatasetStore();

// The selected item from the UI store
const selectedItem = computed(() => uiStore.selectedExplorerItem);

// For dialogs, we only need the ID to pass to them.
// The dialogs themselves will fetch/use the store for full data.
const editDatasetDialogVisible = ref(false);
const editDialogDatasetId = ref(null);

const addFilesDialogVisible = ref(false);
const addFilesDialogDatasetId = ref(null);


// When selectedItem is a dataset, this computed property provides its full details from datasetStore
const currentDatasetDetails = computed(() => {
    if (selectedItem.value && selectedItem.value.type === 'dataset' && selectedItem.value.id) {
        // Ensure detailedDatasets[id] structure matches what the template expects
        // (id, label, description, tags, children with file details)
        return datasetStore.detailedDatasets[selectedItem.value.id];
    }
    return null;
});

// Watch for changes in selectedItem to fetch details if it's a dataset
// and its details are not yet fully loaded in detailedDatasets
watch(selectedItem, async (newItem) => {
    if (newItem && newItem.type === 'dataset' && newItem.id) {
        if (!datasetStore.detailedDatasets[newItem.id] || !datasetStore.detailedDatasets[newItem.id].children) {
            // console.log(`MainContentDisplay: Selected dataset ${newItem.id} details not found or incomplete, fetching...`);
            await datasetStore.fetchDatasetDetails(newItem.id, true); // Force fetch if not fully loaded
        }
    }
}, { immediate: true });


const openEditDatasetDialog = () => {
  if (selectedItem.value && selectedItem.value.type === 'dataset') {
    editDialogDatasetId.value = selectedItem.value.id;
    editDatasetDialogVisible.value = true;
  }
};

const openAddFilesToDatasetDialog = () => {
  if (selectedItem.value && selectedItem.value.type === 'dataset') {
    addFilesDialogDatasetId.value = selectedItem.value.id;
    addFilesDialogVisible.value = true;
  }
};

const handleDialogDatasetUpdated = () => {
  // Data is already refreshed by the store action.
  // If the currently selected item was the one updated, its view will react.
  // If selectedItem's own properties (like name/label) changed, need to ensure uiStore.selectedExplorerItem is also updated
  // or ExplorerPanel updates its node data which then propagates to uiStore.
  // For now, assume datasetStore updates are sufficient for reactivity.
  // We might need to re-select the item in uiStore if its label changed.
  if(editDialogDatasetId.value && datasetStore.detailedDatasets[editDialogDatasetId.value]) {
      const updatedDatasetNodeData = datasetStore.detailedDatasets[editDialogDatasetId.value];
       uiStore.selectExplorerItem({ // Re-select with potentially updated label/data
        id: updatedDatasetNodeData.id,
        label: updatedDatasetNodeData.label,
        type: 'dataset',
        description: updatedDatasetNodeData.description,
        tags: updatedDatasetNodeData.tags,
        children: updatedDatasetNodeData.children, // Pass children for display
        // Pass other fields needed by selectedItem if any
        fileIds: updatedDatasetNodeData.fileIds,
        fileAbsList: updatedDatasetNodeData.fileAbsList,
        ispublic: updatedDatasetNodeData.ispublic,
      });
  }
};

const handleDialogFilesAdded = () => {
  // Dataset details in store are updated by the dialog's action.
  // The `currentDatasetDetails` computed property will update automatically.
  // No specific action needed here other than ensuring dialog closes.
};

const formatFileSize = (size) => {
  if (size === undefined || size === null) return '未知大小';
  if (size === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const confirmRemoveFileFromDataset = async (fileToRemove) => {
  if (!currentDatasetDetails.value || !fileToRemove) {
    ElMessage.error("无法确定要移除的文件或所属数据集。");
    return;
  }
  const datasetId = currentDatasetDetails.value.id;
  // fileToRemove is a child node from dataset's children. It should have 'id' (fileId) and 'path' or 'label'.
  // The file object itself is expected under fileToRemove.file by the store action.
  const fileId = fileToRemove.id || fileToRemove.file?.fileId;
  const fileAbs = fileToRemove.path || fileToRemove.file?.fileAbs || fileToRemove.label;

  if (!fileId) {
    ElMessage.error("文件ID未知，无法移除。");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要从数据集 "${currentDatasetDetails.value.label}" 中移除文件 "${fileToRemove.label || fileId}" 吗？`,
      '移除文件确认',
      { confirmButtonText: '确定移除', cancelButtonText: '取消', type: 'warning', customClass: 'dark-message-box' }
    );
    
    await datasetStore.removeFileFromDataset({ datasetId, fileIdToRemove: fileId, fileAbsToRemove: fileAbs });
    ElMessage.success(`文件 "${fileToRemove.label || fileId}" 已成功从数据集中移除。`);
    // The datasetStore.detailedDatasets[datasetId] will be updated, and currentDatasetDetails will react.
    // uiStore.selectedExplorerItem might need updating if its 'children' list is stale.
    // Re-selecting the dataset in uiStore to ensure its children list is fresh in the main view.
    uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[datasetId] });


  } catch (error) {
    if (error !== 'cancel' && error.message !== 'cancel' && error.name !== 'cancel') { 
      console.error('移除文件失败:', error);
      ElMessage.error(`移除文件失败: ${error.message}`);
    }
  }
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
.dataset-details h4, .folder-details h4 { margin-top: 20px; margin-bottom: 10px; font-size: 14px; color: #c0c0c0; }
.item-children-list { list-style-type: none; padding-left: 5px; font-size: 13px; }
.child-item { padding: 4px 0; color: #b0b0b0; display: flex; align-items: center; justify-content: space-between; }
.child-info { display: flex; align-items: center; }
.child-info .el-icon { margin-right: 6px; font-size: 14px; }
.child-label { margin-right: 5px; }
.child-type { font-size: 0.9em; color: #888; }
.remove-file-button { margin-left: 10px; color: #F56C6C; padding: 2px 4px; }
.remove-file-button .el-icon { font-size: 14px; }
.remove-file-button:hover { color: #f89898; background-color: rgba(245, 108, 108, 0.1); }
.detail-tag { margin-right: 5px; margin-bottom: 5px; background-color: #3a3a3a; border-color: #4a4a4a; color: #b0b0b0; }
.empty-state-custom { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
.dark-theme :deep(.el-empty__description p) { color: #777777; }
.dark-message-box .el-message-box__title { /* color: #e0e0e0; */ }
.dark-message-box .el-message-box__content { /* color: #c0c0c0; */ }
.server-file-details { margin-top:10px; }
</style>
