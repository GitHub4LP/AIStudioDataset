<template>
  <div class="main-content-display">
    <el-card v-if="selectedItem" class="details-card">
      <template #header>
        <div class="card-header">
          <span class="header-title-text">
            <span v-if="selectedItem.type === 'dataset'">{{ t('dataset.details', { name: selectedItem.label }) }}</span>
            <span v-else-if="selectedItem.type === 'file'">{{ t('dataset.node.fileDetails', { name: selectedItem.label }) }}</span>
            <span v-else-if="selectedItem.type === 'folder'">{{ t('dataset.node.folderDetails', { name: selectedItem.label }) }}</span>
            <span v-else-if="selectedItem.type === 'server-file'">{{ t('dataset.node.serverFileDetails', { name: selectedItem.name }) }}</span>
          </span>
          <div class="header-actions">
            <el-button
              v-if="selectedItem.type === 'dataset'"
              type="primary"
              link
              size="small"
              @click="openEditDatasetDialog"
              class="edit-button"
              :title="t('dataset.edit')"
            >
              <el-icon><Edit /></el-icon> {{ t('dataset.edit') }}
            </el-button>
            <el-button
              v-if="selectedItem.type === 'dataset'"
              type="success"
              link
              size="small"
              @click="openAddFilesToDatasetDialog"
              class="add-files-button"
              :title="t('dataset.node.addFiles')"
            >
              <el-icon><Plus /></el-icon> {{ t('dataset.node.addFiles') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- Dataset Details -->
      <div v-if="selectedItem.type === 'dataset' && currentDatasetDetails" class="dataset-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('dataset.id')">{{ currentDatasetDetails.id }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.name')">{{ currentDatasetDetails.label }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.description')">{{ currentDatasetDetails.description || t('common.none') }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.tags')">
            <span v-if="currentDatasetDetails.tags && currentDatasetDetails.tags.length > 0">
              <el-tag v-for="tag in currentDatasetDetails.tags" :key="tag" size="small" class="detail-tag">{{ tag }}</el-tag>
            </span>
            <span v-else>{{ t('common.none') }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <h4 v-if="currentDatasetDetails.children && currentDatasetDetails.children.length > 0" class="section-title">{{ t('dataset.containedItems') }}</h4>
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
        <p v-else class="empty-message">{{ t('dataset.empty') }}</p>
      </div>

      <!-- File Details -->
      <div v-if="selectedItem.type === 'file'" class="file-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('dataset.node.id')">{{ selectedItem.id }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.name')">{{ selectedItem.label }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.datasetId')">{{ selectedItem.datasetId }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.path')">{{ selectedItem.path }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.type')">{{ selectedItem.fileContentType || selectedItem.file?.fileContentType || t('dataset.node.unknown') }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.size')">{{ formatFileSize(selectedItem.fileSize ?? selectedItem.file?.fileSize) }}</el-descriptions-item>
        </el-descriptions>
        <el-button type="primary" size="small" class="download-button" @click="handleDownloadFile">
          <el-icon><Download /></el-icon> {{ t('dataset.node.download') }}
        </el-button>
      </div>

      <!-- Folder Details -->
      <div v-if="selectedItem.type === 'folder'" class="folder-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('dataset.node.id')">{{ selectedItem.id }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.name')">{{ selectedItem.label }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.datasetId')">{{ selectedItem.datasetId }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.path')">{{ selectedItem.path }}</el-descriptions-item>
        </el-descriptions>
        <h4 v-if="selectedItem.children && selectedItem.children.length > 0" class="section-title">{{ t('dataset.containedItems') }}</h4>
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
        <p v-else class="empty-message">{{ t('dataset.node.emptyFolder') }}</p>
      </div>
      
      <!-- Server File Details -->
      <div v-if="selectedItem.type === 'server-file'" class="server-file-details">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('dataset.node.name')">{{ selectedItem.name }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.fullPath')">{{ selectedItem.path }}</el-descriptions-item>
          <el-descriptions-item :label="t('dataset.node.size')">{{ formatFileSize(selectedItem.size) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>
    <el-empty v-else :description="t('dataset.selectItem')" class="empty-state-custom" />

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
import { Folder, Document, Edit, Delete, Plus, Download } from '@element-plus/icons-vue';
import EditDatasetDialog from './EditDatasetDialog.vue';
import AddFilesDialog from './AddFilesDialog.vue';
import DatasetNodeDisplay from './DatasetNodeDisplay.vue'; 
import { useUIStore } from '@/stores/uiStore';
import { useDatasetStore } from '@/stores/datasetStore';
import * as apiService from '@/services/apiService';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const uiStore = useUIStore();
const datasetStore = useDatasetStore();

const selectedItem = computed(() => uiStore.selectedExplorerItem);

const editDatasetDialogVisible = ref(false);
const editDialogDatasetId = ref(null);

const addFilesDialogVisible = ref(false);
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

const openAddFilesToDatasetDialog = () => {
  if (selectedItem.value && selectedItem.value.type === 'dataset') {
    addFilesDialogDatasetId.value = selectedItem.value.id;
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

const handleDialogFilesAdded = () => {
  if (addFilesDialogDatasetId.value && datasetStore.detailedDatasets[addFilesDialogDatasetId.value]) {
    uiStore.selectExplorerItem({ ...datasetStore.detailedDatasets[addFilesDialogDatasetId.value] });
  }
};

const formatFileSize = (size) => {
  if (size === undefined || size === null || Number.isNaN(size)) return t('file.unknownSize');
  if (size === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(size)) / Math.log(k));
  if (i < 0 || i >= sizes.length) return `${size} B`;
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const confirmRemoveFileFromDataset = async (eventData) => {
  if (!eventData || !eventData.fileNode || !eventData.dataset) {
    ElMessage.error(t('error.cannotDetermineFile'));
    return;
  }

  const { fileNode, dataset } = eventData;
  const datasetId = dataset.id;
  const fileId = fileNode.id;

  if (!fileId) {
    ElMessage.error(t('error.unknownFileId'));
    return;
  }
  if (!datasetId) {
    ElMessage.error(t('error.unknownDatasetId'));
    return;
  }
  
  const datasetLabel = dataset.label || datasetId;
  const fileLabel = fileNode.label || fileId;

  try {
    await ElMessageBox.confirm(
      t('file.removeFileConfirm', { dataset: datasetLabel, file: fileLabel }),
      t('file.removeFile'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );

    const response = await datasetStore.removeFileFromDataset(datasetId, fileId);
    if (response.success) {
      ElMessage.success(t('file.removeSuccess'));
      // 更新数据集详情
      await datasetStore.fetchDatasetDetails(datasetId, true);
    } else {
      throw new Error(response.error || t('error.operationFailed'));
    }
  } catch (error) {
    if (error === 'cancel') return;
    ElMessage.error(t('file.removeFailed'));
  }
};

const handleRemoveFileEvent = (eventData) => {
  confirmRemoveFileFromDataset(eventData);
};

const handleFileNodeClick = (fileNode) => {
  uiStore.selectExplorerItem(fileNode);
};

const handleFolderNodeClick = (folderNode) => {
  uiStore.selectExplorerItem(folderNode);
};

const handleDownloadFile = async () => {
  if (!selectedItem.value || selectedItem.value.type !== 'file') return;
  
  try {
    await datasetStore.downloadFile(selectedItem.value.id);
    ElMessage.success(t('file.downloadSuccess'));
  } catch (error) {
    ElMessage.error(t('file.downloadFailed'));
  }
};
</script>

<style scoped>
.main-content-display {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  transition: background-color 0.3s, color 0.3s;
}

.details-card {
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  transition: all 0.3s;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-title-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.edit-button, .add-files-button {
  color: var(--el-text-color-regular);
  transition: color 0.3s;
}

.edit-button:hover, .add-files-button:hover {
  color: var(--el-color-primary);
}

.download-button {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-title {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.item-children-container {
  margin-top: 12px;
  border-radius: 4px;
  background-color: var(--el-bg-color);
}

.empty-message {
  color: var(--el-text-color-secondary);
  text-align: center;
  margin: 20px 0;
  font-size: 14px;
}

.detail-tag {
  margin-right: 8px;
  margin-bottom: 8px;
  background-color: var(--el-fill-color-light);
  border-color: var(--el-border-color-light);
  color: var(--el-text-color-regular);
}

.empty-state-custom {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
}

/* 数据集详情样式 */
.dataset-details {
  padding: 16px 0;
}

.dataset-details :deep(.el-descriptions) {
  background-color: var(--el-bg-color-overlay);
  border-radius: 4px;
}

.dataset-details :deep(.el-descriptions__header) {
  margin-bottom: 16px;
}

.dataset-details :deep(.el-descriptions__title) {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 500;
}

.dataset-details :deep(.el-descriptions__label) {
  color: var(--el-text-color-regular);
  font-weight: 500;
  background-color: var(--el-fill-color-light);
}

.dataset-details :deep(.el-descriptions__content) {
  color: var(--el-text-color-primary);
  background-color: var(--el-bg-color);
}

/* 文件详情样式 */
.file-details, .folder-details, .server-file-details {
  padding: 16px 0;
}

.file-details :deep(.el-descriptions),
.folder-details :deep(.el-descriptions),
.server-file-details :deep(.el-descriptions) {
  background-color: var(--el-bg-color-overlay);
  border-radius: 4px;
}

.file-details :deep(.el-descriptions__label),
.folder-details :deep(.el-descriptions__label),
.server-file-details :deep(.el-descriptions__label) {
  color: var(--el-text-color-regular);
  font-weight: 500;
  background-color: var(--el-fill-color-light);
}

.file-details :deep(.el-descriptions__content),
.folder-details :deep(.el-descriptions__content),
.server-file-details :deep(.el-descriptions__content) {
  color: var(--el-text-color-primary);
  background-color: var(--el-bg-color);
}

/* 通用描述列表样式 */
:deep(.el-descriptions) {
  --el-descriptions-item-bordered-label-background: var(--el-fill-color-light);
}

:deep(.el-descriptions__label) {
  color: var(--el-text-color-regular);
  font-weight: 500;
}

:deep(.el-descriptions__content) {
  color: var(--el-text-color-primary);
}

:deep(.el-descriptions__body) {
  background-color: var(--el-bg-color-overlay);
}

:deep(.el-descriptions__table) {
  background-color: var(--el-bg-color-overlay);
}

:deep(.el-descriptions__cell) {
  padding: 12px 16px;
}

:deep(.el-descriptions__label.is-bordered-label) {
  background-color: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
}

:deep(.el-descriptions__content.is-bordered-content) {
  border-color: var(--el-border-color-lighter);
}
</style>
