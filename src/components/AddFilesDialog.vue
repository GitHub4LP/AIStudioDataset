<template>
  <el-dialog
    :model-value="visible"
    :title="t('file.addFilesToDataset', { name: datasetName })"
    width="60%"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="!isProcessingItems" 
    :close-on-press-escape="!isProcessingItems"
    @open="onDialogOpen"
    class="add-files-dialog"
  >
    <div v-if="isLoadingInitialData" class="loading-dataset-placeholder">
        <el-skeleton :rows="2" animated />
        {{ t('dataset.loadingDetails') }}
    </div>
    <div v-else-if="!targetDatasetDetails" class="dialog-error-placeholder">
        {{ t('error.loadDatasetFailed') }}
    </div>
    <div v-else>
      <p>
        {{ t('dataset.target') }}: <strong>{{ targetDatasetDetails.label }}</strong>
        <span v-if="basePathInDataset">{{ t('file.targetPath') }}: <strong>{{ basePathInDataset }}</strong></span>
      </p>
      
      <h4>{{ t('file.selectServerFiles') }}</h4>
      <div class="server-file-browser-in-dialog">
        <div class="path-selector">
          <el-select v-model="localSelectedBasePath" :placeholder="t('file.selectBasePath')" @change="handleLocalBasePathChange" size="small" :disabled="isProcessingItems">
            <el-option
              v-for="pathItem in localBasePaths"
              :key="pathItem.value"
              :label="pathItem.label"
              :value="pathItem.value"
            />
          </el-select>
        </div>
        <div class="path-navigation">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item
              v-for="(item, index) in localPathSegments"
              :key="index"
              @click="!isProcessingItems && handleLocalNavigateToPath(index)"
              :class="{ 'breadcrumb-link': !isProcessingItems }"
            >
              {{ item }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div v-if="localLoadingFiles" class="loading-state">
          <el-skeleton :rows="3" animated />
        </div>
        <el-table
          v-else
          :data="localServerFiles"
          @selection-change="handleServerItemSelectionChange"
          ref="serverFilesTableRef"
          height="250px"
          size="small"
          class="files-table"
          :row-style="{ cursor: isProcessingItems ? 'not-allowed' : 'default' }"
        >
          <el-table-column type="selection" width="45" :selectable="isItemSelectable" :disabled="isProcessingItems" />
          <el-table-column prop="name" :label="t('file.name')">
            <template #default="{ row }">
              <div class="file-name-in-dialog" @click="!isProcessingItems && handleLocalItemClick(row)" :class="{ 'disabled-click': isProcessingItems }">
                <el-icon v-if="row.type === '文件夹'"><Folder /></el-icon>
                <el-icon v-else><Document /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="type" :label="t('file.type')" width="80" />
          <el-table-column prop="size" :label="t('file.size')" width="100">
            <template #default="{ row }">
              {{ row.type === '文件夹' ? '-' : formatFileSize(row.size) }}
            </template>
          </el-table-column>
        </el-table>
        <div v-if="!localLoadingFiles && localServerFiles.length === 0" class="empty-state-dialog">
          <el-empty :description="t('file.empty')" :image-size="50" />
        </div>
      </div>

      <div v-if="selectedServerItems.length > 0" class="selected-files-summary">
        <h4>{{ t('file.selectedFiles', { count: selectedServerItems.length }) }}:</h4>
        <ul>
          <li v-for="item in selectedServerItems" :key="item.path">
            {{ item.name }} ({{ t('file.type') }}: {{ item.type }}, {{ t('file.path') }}: {{ item.path }})
          </li>
        </ul>
      </div>

    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" :disabled="isProcessingItems">{{ t('common.cancel') }}</el-button>
        <el-button 
          type="primary" 
          @click="handleAddSelectedItems" 
          :loading="isProcessingItems || isLoadingInitialData"
          :disabled="selectedServerItems.length === 0"
        >
          {{ isProcessingItems ? t('file.processingFiles', { current: itemsProcessedCount, total: totalItemsToProcess }) : t('common.confirm') }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { 
  ElDialog, ElSelect, ElOption, ElBreadcrumb, ElBreadcrumbItem, 
  ElTable, ElTableColumn, ElIcon, ElEmpty, ElSkeleton, 
  ElButton, ElMessage 
} from 'element-plus';
import { Folder, Document } from '@element-plus/icons-vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useUploadStore } from '@/stores/uploadStore'; // Import upload store
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { getServerFiles as apiGetServerFiles, registerServerFile as apiRegisterServerFile } from '@/services/apiService';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const props = defineProps({
  visible: Boolean,
  datasetId: {
    type: String,
    required: true
  },
  datasetName: { 
    type: String,
    default: ''
  },
  basePathInDataset: { 
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:visible', 'items-added']); 

const datasetStore = useDatasetStore();
const uploadStore = useUploadStore(); // Initialize upload store

const localCurrentPath = ref('.');
const localServerFiles = ref([]);
const localLoadingFiles = ref(false);
const localBasePaths = [ 
  { label: t('file.rootDirectory'), value: '.' },
  { label: t('file.uploadDirectory'), value: 'uploads' },
];
const localSelectedBasePath = ref('.');
const selectedServerItems = ref([]); 
const serverFilesTableRef = ref(null);
const isProcessingItems = ref(false);
const isLoadingInitialData = ref(false);
const targetDatasetDetails = ref(null);

const itemsProcessedCount = ref(0);
const totalItemsToProcess = ref(0);

const localPathSegments = computed(() => {
  if (typeof localCurrentPath.value !== 'string') return [localSelectedBasePath.value];
  const segments = localCurrentPath.value.split('/');
  if (segments.length === 0 || (segments.length === 1 && segments[0] === '')) {
      const basePath = localBasePaths.find(bp => bp.value === localSelectedBasePath.value);
      return [basePath ? basePath.label : localSelectedBasePath.value];
  }
  // Special handling for root alias like "uploads"
  if (segments.length === 1 && localBasePaths.some(bp => bp.value === segments[0])) {
     const basePathLabel = localBasePaths.find(bp => bp.value === segments[0])?.label;
     return basePathLabel ? [basePathLabel] : [segments[0]]; // Return just the alias label
  }
  // For deeper paths, show the alias as root then subsequent parts
  const rootAlias = localBasePaths.find(bp => bp.value === localSelectedBasePath.value)?.label || localSelectedBasePath.value;
  const pathRelativeToBase = localCurrentPath.value.startsWith(localSelectedBasePath.value + '/') 
      ? localCurrentPath.value.substring(localSelectedBasePath.value.length + 1) 
      : localCurrentPath.value;

  if (!pathRelativeToBase || pathRelativeToBase === '.') return [rootAlias];
  
  return [rootAlias, ...pathRelativeToBase.split('/').filter(s => s)];
});


const fetchLocalServerFiles = async (path) => {
  localLoadingFiles.value = true;
  localServerFiles.value = [];
  try {
    const data = await apiGetServerFiles(path);
    localServerFiles.value = data.files.map(f => ({
        ...f,
        // Ensure path is correctly formed relative to the browsed structure
        path: data.currentPath === '.' ? f.name : ( data.currentPath.endsWith('/') ? `${data.currentPath}${f.name}` : `${data.currentPath}/${f.name}`)
    }));
    localCurrentPath.value = data.currentPath;
  } catch (error) {
    ElMessage.error(`(Dialog) 获取文件列表失败: ${error.message}`);
    localServerFiles.value = [];
  } finally {
    localLoadingFiles.value = false;
  }
};

const handleLocalItemClick = (item) => { 
  if (isProcessingItems.value) return;
  if (item.type === '文件夹') {
    fetchLocalServerFiles(item.path);
  }
};

const handleLocalNavigateToPath = (index) => {
  if (isProcessingItems.value) return;
  let newPath;
  const currentSegments = localCurrentPath.value.split('/');
  
  if (index === 0) { // Clicked on the root alias
    newPath = localSelectedBasePath.value;
  } else {
    // Reconstruct path based on actual segments, not label segments
    // Need to map label segments back to actual path segments if they differ significantly
    // For simplicity, assume segments in localPathSegments (excluding root alias) map to currentSegments after selectedBasePath
    const pathParts = localCurrentPath.value.startsWith(localSelectedBasePath.value + '/')
        ? localCurrentPath.value.substring(localSelectedBasePath.value.length + 1).split('/')
        : (localCurrentPath.value === localSelectedBasePath.value ? [] : localCurrentPath.value.split('/'));

    newPath = localSelectedBasePath.value;
    if (pathParts.length > 0 && index > 0) { // index 0 is root alias
        newPath += '/' + pathParts.slice(0, index -1).join('/'); // index-1 because segment array for pathParts doesn't include root alias
    }
  }
  fetchLocalServerFiles(newPath);
};


const handleLocalBasePathChange = (newBasePath) => {
  if (isProcessingItems.value) return;
  localSelectedBasePath.value = newBasePath;
  fetchLocalServerFiles(newBasePath);
};

const formatFileSize = (size) => {
  if (size === undefined || size === null) return '-';
  if (size === 0) return '0 B';
  const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const isItemSelectable = () => !isProcessingItems.value; // Allow selecting both files and folders

const handleServerItemSelectionChange = (selection) => {
  if (isProcessingItems.value) return;
  selectedServerItems.value = selection;
};

const onDialogOpen = async () => {
  isLoadingInitialData.value = true;
  targetDatasetDetails.value = null;
  if (props.datasetId) {
    let details = datasetStore.getDatasetById(props.datasetId);
    if (!details || !details.fileIds) { 
        details = await datasetStore.fetchDatasetDetails(props.datasetId, true);
    }
    targetDatasetDetails.value = details;

    localCurrentPath.value = '.'; 
    localSelectedBasePath.value = '.';
    selectedServerItems.value = [];
    itemsProcessedCount.value = 0;
    totalItemsToProcess.value = 0;
    if (serverFilesTableRef.value) serverFilesTableRef.value.clearSelection();
    await fetchLocalServerFiles(localSelectedBasePath.value);
  } else {
      ElMessage.error("未提供目标数据集ID。");
  }
  isLoadingInitialData.value = false;
};

watch(() => props.visible, (newVisible) => {
  if (newVisible && props.datasetId) {
    onDialogOpen();
  }
}, { immediate: true });


const handleAddSelectedItems = async () => {
  if (!targetDatasetDetails.value || selectedServerItems.value.length === 0) {
    ElMessage.info(t('file.noItemsSelected'));
    return;
  }
  isProcessingItems.value = true;
  itemsProcessedCount.value = 0;
  totalItemsToProcess.value = selectedServerItems.value.length;

  const allResults = []; 
  let overallSuccess = true;

  const batchTaskId = uuidv4();
  const isSingleItem = selectedServerItems.value.length === 1;
  const firstItem = selectedServerItems.value[0];
  const isSingleFolderSelected = isSingleItem && firstItem.type === '文件夹';

  let taskDetails;

  if (isSingleFolderSelected) {
    taskDetails = {
      id: batchTaskId,
      name: firstItem.name,
      type: 'folder',
      uploadType: 'server-folder',
      targetDatasetId: props.datasetId,
      targetDatasetName: props.datasetName || targetDatasetDetails.value.label,
      serverFilePath: firstItem.path, // CRUCIAL
      itemCount: 1, 
      // status will be set to 'queued' by uploadStore.addTask
    };
  } else {
    const batchTaskName = isSingleItem ? firstItem.name : t('file.addMultipleItems', { count: selectedServerItems.value.length });
    const isEffectivelyFolderOperation = !isSingleItem || (isSingleItem && firstItem.type === '文件夹');
    
    taskDetails = {
      id: batchTaskId,
      name: batchTaskName,
      type: isEffectivelyFolderOperation ? 'folder' : 'file',
      uploadType: isEffectivelyFolderOperation ? 'server-folder' : 'server-file',
      targetDatasetId: props.datasetId,
      targetDatasetName: props.datasetName || targetDatasetDetails.value.label,
      itemCount: totalItemsToProcess.value,
      // status will be set to 'queued' by uploadStore.addTask
    };

    if (isSingleItem && firstItem.type !== '文件夹') { // Single server file
      taskDetails.serverFilePath = firstItem.path;
      taskDetails.uploadType = 'server-file';
      taskDetails.type = 'file';
    }
  }
  
  uploadStore.addTask(taskDetails);

  const allRegisteredFilesForDatasetUpdate = []; 
  let overallBatchSuccess = true;

  try {
    if (isSingleFolderSelected) {
      // For a single server folder, the main task (batchTaskId) has been added with serverFilePath.
      // The backend (via _performActualUpload in uploadStore) will handle listing files and sending SSEs.
      // So, we skip the apiRegisterServerFile loop here.
      // We assume the uploadStore will update the task status based on SSE.
      overallBatchSuccess = true; // Placeholder: actual success determined by SSE via uploadStore.
                                  // UI should reflect progress based on SSE updates to the main task (batchTaskId).
                                  // No files are directly registered here by the dialog for this path.
    } else {
      // Existing loop for apiRegisterServerFile for other cases (e.g., multiple server files, or single server file)
      for (const item of selectedServerItems.value) {
        let currentSubTaskId = null;
        // Determine if a sub-task is needed based on the main task's type.
        if (taskDetails.type === 'folder') { // If the main task is a 'folder' (e.g., multi-selection)
           currentSubTaskId = uploadStore.addSubTask(batchTaskId, {
              name: item.name,
              type: 'file', // Sub-tasks for server items are files for registration purposes
              status: 'processing', 
              progress: 0,
              uploadType: 'server-file', // Each item registration is a 'server-file' type action
           });
        }
  
        const payload = {
          filePath: item.path,
          fileName: item.name,
          folderPath: props.basePathInDataset, 
          uploadId: currentSubTaskId || batchTaskId, 
        };
  
        try {
          const registrationResults = await apiRegisterServerFile(payload); 
          const resultsArray = Array.isArray(registrationResults) ? registrationResults : [registrationResults];
  
          for (const result of resultsArray) {
            if (result.success && result.fileId) {
              allRegisteredFilesForDatasetUpdate.push({ fileId: result.fileId, fileAbs: result.fileAbs, name: result.fileName });
              if (currentSubTaskId) { 
                uploadStore.updateSubTaskStatus(batchTaskId, currentSubTaskId, 'completed', 100, null, { fileId: result.fileId, fileAbs: result.fileAbs });
              } else if (taskDetails.uploadType === 'server-file') { // Single server-file main task
                uploadStore.updateTaskStatus(batchTaskId, 'completed', 100, null, { fileId: result.fileId, fileAbs: result.fileAbs });
              }
            } else {
              overallBatchSuccess = false;
              const errorMsg = result.error || t('error.operationFailed');
              if (currentSubTaskId) {
                uploadStore.updateSubTaskStatus(batchTaskId, currentSubTaskId, 'failed', 0, errorMsg);
              } else if (taskDetails.uploadType === 'server-file') {
                uploadStore.updateTaskStatus(batchTaskId, 'failed', 0, errorMsg);
              }
              ElMessage.error(t('file.registrationFailed', { name: item.name, error: errorMsg })); 
            }
          }
        } catch (error) { 
          overallBatchSuccess = false;
          const errorMsg = error.message || t('error.operationFailed');
          if (currentSubTaskId) {
            uploadStore.updateSubTaskStatus(batchTaskId, currentSubTaskId, 'failed', 0, errorMsg);
          } else if (taskDetails.uploadType === 'server-file') {
            uploadStore.updateTaskStatus(batchTaskId, 'failed', 0, errorMsg);
          }
          ElMessage.error(t('file.registrationFailed', { name: item.name, error: errorMsg }));
        }
        itemsProcessedCount.value++;
        
        if (taskDetails.type === 'file') { // For single file main task, update its own progress
           const task = uploadStore.tasks.find(t=>t.id === batchTaskId);
           if(task && task.status === 'processing') { 
              task.progress = Math.round((itemsProcessedCount.value / totalItemsToProcess.value) * 100);
           }
        }
        // For folder main tasks, progress is derived from subtasks in uploadStore.
      }
    } // End of else for !isSingleFolderSelected

    // After all items are processed (or skipped for single server folder)
    // This block will only run if files were registered by the loop above.
    if (allRegisteredFilesForDatasetUpdate.length > 0) {
      try {
        await datasetStore.addFilesToDataset({
            datasetId: props.datasetId,
            newFilesData: allRegisteredFilesForDatasetUpdate,
            existingDatasetData: { /* Minimal existing data for merge */
                datasetName: targetDatasetDetails.value.label,
                fileIds: targetDatasetDetails.value.fileIds || [],
                fileAbsList: targetDatasetDetails.value.fileAbsList || [],
            }
        });
      } catch (error) {
        console.error('Error adding files to dataset metadata:', error);
        ElMessage.error(t('dataset.addFilesFailed', { error: error.message || t('error.unknown') }));
        // If metadata update fails, the overall batch is considered failed.
        uploadStore.updateTaskStatus(batchTaskId, 'failed', uploadStore.tasks.find(t=>t.id === batchTaskId)?.progress || 100, t('dataset.addFilesFailed', { error: error.message }));
        overallBatchSuccess = false;
      }
    }

    // Finalize main batch task status
    const finalBatchTask = uploadStore.tasks.find(t => t.id === batchTaskId);
    if (finalBatchTask && finalBatchTask.status !== 'failed' && finalBatchTask.status !== 'completed') {
        if (overallBatchSuccess && allRegisteredFilesForDatasetUpdate.length > 0) {
            uploadStore.updateTaskStatus(batchTaskId, 'completed', 100);
        } else if (overallBatchSuccess && allRegisteredFilesForDatasetUpdate.length === 0 && selectedServerItems.value.length > 0) {
            // All individual operations succeeded but yielded no files (e.g. empty folders registered successfully)
            uploadStore.updateTaskStatus(batchTaskId, 'completed', 100, t('file.noActualFilesRegistered')); // New i18n key
        } else { // Some failures occurred
             uploadStore.updateTaskStatus(batchTaskId, 'failed', finalBatchTask.progress, finalBatchTask.error || t('upload.batchFailed'));
        }
    }
    
    if (overallBatchSuccess && allRegisteredFilesForDatasetUpdate.length > 0) {
        ElMessage.success(t('file.allItemsAdded', { name: props.datasetName || targetDatasetDetails.value.label }));
    } else if (allRegisteredFilesForDatasetUpdate.length > 0 && !overallBatchSuccess) {
        ElMessage.warning(t('file.partialSuccess', { count: allRegisteredFilesForDatasetUpdate.length }));
    } else if (!overallBatchSuccess) {
        ElMessage.error(t('file.noItemsProcessed'));
    }


  } catch (error) { // Catch error for the overall loop or setup
    console.error(t('error.operationFailed'), error);
    uploadStore.updateTaskStatus(batchTaskId, 'failed', 0, error.message || t('error.unknown'));
    ElMessage.error(error.message || t('error.operationFailed'));
    overallBatchSuccess = false;
  } finally {
    isProcessingItems.value = false;
    if (overallBatchSuccess && allRegisteredFilesForDatasetUpdate.length > 0) {
        emit('items-added');
        emit('update:visible', false); // Close dialog only on full success
    }
  }
};

</script>

<style scoped>
.add-files-dialog .el-dialog__body { padding-top: 10px; padding-bottom: 10px; }
.loading-dataset-placeholder, .dialog-error-placeholder { text-align: center; padding: 20px; color: #909399; }
.server-file-browser-in-dialog { border: 1px solid #e0e0e0; padding: 10px; border-radius: 4px; margin-top: 10px; }
.path-selector { margin-bottom: 8px; }
.path-navigation { margin-bottom: 8px; padding: 6px; background: #f5f7fa; border-radius: 3px; font-size: 12px; }
.path-navigation .el-breadcrumb__item .breadcrumb-link :deep(.el-breadcrumb__inner) {
  cursor: pointer !important;
}
.files-table { font-size: 12px; }
.file-name-in-dialog { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.file-name-in-dialog:not(.disabled-click):hover span { color: #409EFF; }
.file-name-in-dialog.disabled-click { cursor: not-allowed; opacity: 0.7; }
.empty-state-dialog { margin-top: 10px; }
.selected-files-summary { margin-top: 15px; padding: 10px; background-color: #f9f9f9; border-radius: 4px; }
.selected-files-summary h4 { margin-top: 0; margin-bottom: 8px; font-size: 14px; }
.selected-files-summary ul { list-style-type: none; padding-left: 0; font-size: 13px; max-height: 100px; overflow-y: auto; }
.selected-files-summary li { padding: 2px 0; }
.dialog-footer { display: flex; justify-content: flex-end; }
</style>
