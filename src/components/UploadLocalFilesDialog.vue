<template>
  <el-dialog
    :model-value="visible"
    :title="t('upload.uploadToDataset', { name: datasetName })"
    width="600px"
    @update:model-value="$emit('update:visible', $event)"
    @closed="resetDialog"
    :close-on-click-modal="!isLoading" 
    :close-on-press-escape="!isLoading"
    class="upload-local-files-dialog"
  >
    <div v-if="isLoading && totalFilesToUploadCount > 0" class="loading-indicator">
      <el-progress
        :text-inside="true"
        :stroke-width="20"
        :percentage="uploadProgress"
        status="success" 
      />
      <p v-if="currentUploadingFile">{{ t('upload.uploadingFile', { name: currentUploadingFile, current: filesProcessedCount, total: totalFilesToUploadCount }) }}</p>
      <p v-else>{{ t('upload.preparingUpload', { count: totalFilesToUploadCount }) }}</p>
    </div>

    <el-form label-position="top" :disabled="isLoading">
      <el-form-item v-if="basePathInDataset" :label="t('upload.targetPath')">
        <el-input :value="basePathInDataset" disabled />
      </el-form-item>

      <el-form-item :label="t('upload.selectFilesOrFolder')">
        <el-upload
          ref="uploaderRef"
          action="#"
          drag
          multiple
          :http-request="handleHttpRequest"
          :on-change="handleFileSelectionChange"
          :on-remove="handleFileRemoveFromDisplayList"
          :file-list="displayFileList"
          :auto-upload="false" 
          class="local-file-uploader"
        >
          <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
          <div class="el-upload__text">{{ t('upload.dragOrClick') }}</div>
        </el-upload>
        <el-button @click="triggerFolderInput" style="margin-top: 10px;" :disabled="isLoading">
          <el-icon style="margin-right: 5px;"><FolderAdd /></el-icon> {{ t('upload.selectFolder') }}
        </el-button>
        <input 
          type="file" 
          webkitdirectory 
          multiple 
          style="display: none" 
          ref="folderInputRef" 
          @change="handleFolderInputChange"
          :disabled="isLoading"
        />
      </el-form-item>

      <div v-if="selectedFiles.length > 0" class="selected-files-preview">
        <h4>{{ t('upload.filesToUpload', { count: selectedFiles.length }) }}:</h4>
        <el-table :data="selectedFiles" size="small" height="150px" stripe border>
          <el-table-column prop="name" :label="t('file.name')" />
          <el-table-column prop="size" :label="t('file.size')" width="100">
            <template #default="{ row }">{{ formatFileSize(row.size) }}</template>
          </el-table-column>
          <el-table-column prop="relativePath" :label="t('upload.relativePath')" />
        </el-table>
      </div>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" :disabled="isLoading">{{ t('common.cancel') }}</el-button>
        <el-button 
          type="primary" 
          @click="startUploadProcess" 
          :loading="isLoading"
          :disabled="selectedFiles.length === 0"
        >
          {{ isLoading ? t('upload.uploadingProgress', { current: filesProcessedCount, total: totalFilesToUploadCount }) : t('upload.startUpload') }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import { 
  ElDialog, ElForm, ElFormItem, ElInput, ElUpload, ElButton, ElIcon, 
  ElMessage, ElProgress, ElTable, ElTableColumn
} from 'element-plus';
import { UploadFilled, FolderAdd } from '@element-plus/icons-vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useUploadStore } from '@/stores/uploadStore';
import { v4 as uuidv4 } from 'uuid';
import * as apiService from '@/services/apiService';
import { formatFileSize as utilFormatFileSize } from '@/utils/fileDisplayUtils';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  visible: Boolean,
  datasetId: { type: String, required: true },
  datasetName: { type: String, default: '' },
  basePathInDataset: { type: String, default: '' },
  initialFiles: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:visible', 'files-added', 'initial-files-processed']);

const datasetStore = useDatasetStore();
const uploadStore = useUploadStore();
const uploaderRef = ref(null);
const folderInputRef = ref(null);

const isLoading = ref(false);
const displayFileList = ref([]); 
const selectedFiles = ref([]); 

const uploadProgress = ref(0);
const filesProcessedCount = ref(0);
const totalFilesToUploadCount = ref(0);
const currentUploadingFile = ref('');

watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetDialog();
    if (props.initialFiles && props.initialFiles.length > 0) {
      for (const file of props.initialFiles) {
        addFileToList(file, file.webkitRelativePath || '');
        // Create a corresponding entry for displayFileList for UI consistency
        displayFileList.value.push({
          name: file.name,
          size: file.size,
          uid: file.uid || `${Date.now()}_${Math.random()}_initialfile`, // Ensure uid for display
          status: 'ready', // Mimic el-upload's file status
          raw: file, // Keep a reference to the raw file if needed by el-upload internals or other logic
        });
      }
      emit('initial-files-processed');
    }
  }
});

const formatFileSize = (size) => {
  return utilFormatFileSize(size) || 'N/A';
};

const resetDialog = () => {
  isLoading.value = false;
  displayFileList.value = [];
  selectedFiles.value = [];
  uploadProgress.value = 0;
  filesProcessedCount.value = 0;
  totalFilesToUploadCount.value = 0;
  currentUploadingFile.value = '';
  if (uploaderRef.value) {
    uploaderRef.value.clearFiles();
  }
   if (folderInputRef.value) {
    folderInputRef.value.value = '';
  }
};

const handleHttpRequest = () => { /* Dummy */ };

const addFileToList = (file, relativePath = '') => {
  const existingFileIndex = selectedFiles.value.findIndex(
    f => f.name === file.name && (f.relativePath || '') === relativePath
  );
  if (existingFileIndex === -1) {
    selectedFiles.value.push({
      raw: file, 
      name: file.name,
      size: file.size,
      type: file.type,
      uid: file.uid || `${Date.now()}_${Math.random()}`,
      relativePath: relativePath, 
    });
  }
};

const handleFileSelectionChange = (file, currentDisplayFileList) => {
  displayFileList.value = [...currentDisplayFileList]; 
  if (file.raw) { 
      addFileToList(file.raw, '');
  }
};

const handleFileRemoveFromDisplayList = (file) => {
  selectedFiles.value = selectedFiles.value.filter(f => f.uid !== file.uid);
  displayFileList.value = displayFileList.value.filter(f => f.uid !== file.uid);
};

const triggerFolderInput = () => {
  folderInputRef.value?.click();
};

const handleFolderInputChange = (event) => {
  const files = event.target.files;
  if (files) {
    for (const file of files) {
      const relativePath = file.webkitRelativePath || '';
      addFileToList(file, relativePath);
      displayFileList.value.push({ 
        name: file.name, 
        size: file.size, 
        uid: file.uid || `${Date.now()}_${Math.random()}_folderfile`,
        status: 'ready' 
      });
    }
  }
   if (folderInputRef.value) folderInputRef.value.value = ''; 
};

const startUploadProcess = async () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning(t('upload.selectFilesFirst'));
    return;
  }

  isLoading.value = true;
  filesProcessedCount.value = 0;
  totalFilesToUploadCount.value = selectedFiles.value.length;
  uploadProgress.value = 0;
  
  const uploadedFileResults = [];
  let overallSuccess = true;
  let anyFileProcessed = false;

  // Add a main task for this batch
  const batchTaskId = uuidv4();
  const uploadType = selectedFiles.value.length > 1 || (selectedFiles.value.length === 1 && selectedFiles.value[0].relativePath) ? 'local-folder' : 'local-file';
  
  const batchTaskName = uploadType === 'local-folder' ? 
    (selectedFiles.value[0]?.relativePath.split('/')[0] || t('upload.multiFileUpload', { name: props.datasetName })) : 
    (selectedFiles.value[0]?.name || t('upload.fileUpload', { name: props.datasetName }));

  uploadStore.addTask({
    id: batchTaskId,
    name: batchTaskName,
    type: uploadType === 'local-folder' ? 'folder' : 'file',
    uploadType: uploadType,
    targetDatasetId: props.datasetId,
    targetDatasetName: props.datasetName,
    status: 'uploading', // Start as uploading, sub-tasks will drive progress
    progress: 0,
    totalSize: selectedFiles.value.reduce((acc, f) => acc + (f.size || 0), 0),
    itemCount: totalFilesToUploadCount.value, // For folder, this is count of files in folder
  });

  const uploadedFileResultsForDatasetUpdate = []; // For datasetStore.addFilesToDataset
  let overallBatchSuccess = true; // Tracks if all files in the batch uploaded successfully

  for (const fileObj of selectedFiles.value) {
    let subTaskId = null;
    if (uploadType === 'local-folder') {
      subTaskId = uploadStore.addSubTask(batchTaskId, { 
        name: fileObj.name, 
        type: 'file', 
        status: 'uploading', 
        progress: 0, 
        totalSize: fileObj.size,
        uploadType: 'local-file' // Individual files within a folder are 'local-file'
      });
    }
    
    // Update UI for current file being processed (if needed, or handled by subtask display)
    // currentUploadingFile.value = fileObj.name; // This might be less relevant if subtasks show names

    try {
      const formData = new FormData();
      formData.append('file', fileObj.raw);
      formData.append('uploadId', subTaskId || batchTaskId);
      
      // Simulate some progress for the sub-task if it exists, or main task for single file
      const targetTaskIdForProgress = subTaskId || batchTaskId;
      uploadStore.updateTaskStatus(targetTaskIdForProgress, 'uploading', 10); // Initial progress bump

      const response = await apiService.uploadLocalFile(formData); 

      if (response.success && response.fileId) {
        let finalFileAbs = response.fileAbs; 
        if (props.basePathInDataset) {
          finalFileAbs = `${props.basePathInDataset.replace(/^\/+|\/+$/g, '')}/${finalFileAbs}`;
        }
        // Adjust finalFileAbs based on relativePath if it's a folder upload
        if (fileObj.relativePath) {
            const dirPath = fileObj.relativePath.substring(0, fileObj.relativePath.lastIndexOf('/'));
            if(dirPath) {
                 finalFileAbs = props.basePathInDataset 
                                ? `${props.basePathInDataset.replace(/^\/+|\/+$/g, '')}/${dirPath}/${fileObj.name}`
                                : `${dirPath}/${fileObj.name}`;
            } else { // File at the root of the selected folder (or a single file with relativePath set)
                 finalFileAbs = props.basePathInDataset
                                ? `${props.basePathInDataset.replace(/^\/+|\/+$/g, '')}/${fileObj.name}`
                                : fileObj.name;
            }
        }
        finalFileAbs = finalFileAbs.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        
        uploadedFileResultsForDatasetUpdate.push({ fileId: response.fileId, fileAbs: finalFileAbs });

        if (uploadType === 'local-folder' && subTaskId) {
          uploadStore.updateSubTaskStatus(batchTaskId, subTaskId, 'completed', 100, null, { fileId: response.fileId, fileAbs: finalFileAbs });
        } else { // Single file upload, update main task
          uploadStore.updateTaskStatus(batchTaskId, 'completed', 100, null, { fileId: response.fileId, fileAbs: finalFileAbs });
        }
        anyFileProcessed = true;
      } else {
        overallBatchSuccess = false;
        const errorMsg = response.error || t('error.operationFailed');
        if (uploadType === 'local-folder' && subTaskId) {
          uploadStore.updateSubTaskStatus(batchTaskId, subTaskId, 'failed', filesProcessedCount.value / totalFilesToUploadCount.value * 100, errorMsg);
        } else {
          uploadStore.updateTaskStatus(batchTaskId, 'failed', filesProcessedCount.value / totalFilesToUploadCount.value * 100, errorMsg);
        }
        ElMessage.error(t('file.uploadFailed', { name: fileObj.name, error: errorMsg }));
      }
    } catch (error) {
      overallBatchSuccess = false;
      const errorMsg = error.message || t('error.networkError');
      if (uploadType === 'local-folder' && subTaskId) {
        uploadStore.updateSubTaskStatus(batchTaskId, subTaskId, 'failed', filesProcessedCount.value / totalFilesToUploadCount.value * 100, errorMsg);
      } else {
        uploadStore.updateTaskStatus(batchTaskId, 'failed', filesProcessedCount.value / totalFilesToUploadCount.value * 100, errorMsg);
      }
      ElMessage.error(t('file.uploadFailed', { name: fileObj.name, error: errorMsg }));
    }
    filesProcessedCount.value++;
    // Main batch task progress is now handled by sub-task updates in uploadStore
    // For single file, it's updated directly.
    // uploadProgress.value = Math.round((filesProcessedCount.value / totalFilesToUploadCount.value) * 100);
  }
  // currentUploadingFile.value = ''; // Not needed if subtasks manage this

  // After loop, update dataset metadata if any files were successfully processed
  if (uploadedFileResultsForDatasetUpdate.length > 0) {
    try {
      const dataset = datasetStore.getDatasetById(props.datasetId);
      if (!dataset) {
        throw new Error(t('error.unknownDatasetId'));
      }
      await datasetStore.addFilesToDataset({
        datasetId: props.datasetId,
        newFilesData: uploadedFileResultsForDatasetUpdate,
        existingDatasetData: { /* Minimal existing data, as datasetStore should handle merge */
          datasetName: dataset.label || dataset.name || props.datasetName,
          fileIds: dataset.fileIds || [], // Pass existing fileIds for correct merging
          fileAbsList: dataset.fileAbsList || [], // Pass existing fileAbsList
        },
      });
      emit('files-added'); 
    } catch (error) {
      console.error('Error adding files to dataset metadata:', error);
      ElMessage.error(t('dataset.addFilesFailed', { error: error.message || t('error.unknown') }));
      // This doesn't mean the file uploads failed, just the metadata update.
      // The batch task in uploadStore might still be 'completed' if all files uploaded.
      // We might want to add an error to the batch task here if metadata update fails.
      uploadStore.updateTaskStatus(batchTaskId, 'failed', uploadStore.tasks.find(t=>t.id === batchTaskId)?.progress || 100, t('dataset.addFilesFailed', { error: error.message }));
      overallBatchSuccess = false; // Mark batch as failed if metadata update fails
    }
  }
  
  // Final status update for the main batch task in uploadStore
  // This is mostly handled by sub-task completion logic in uploadStore itself.
  // However, if no files were processed at all, or if metadata update failed, ensure correct state.
  const finalBatchTask = uploadStore.tasks.find(t => t.id === batchTaskId);
  if (finalBatchTask && finalBatchTask.status !== 'failed' && finalBatchTask.status !== 'completed') {
    // If not already set to failed by sub-task logic or metadata error
    if (overallBatchSuccess && anyFileProcessed) {
        // This might be redundant if subtask logic correctly sets parent to completed
        uploadStore.updateTaskStatus(batchTaskId, 'completed', 100);
    } else if (!anyFileProcessed && selectedFiles.value.length > 0) {
        uploadStore.updateTaskStatus(batchTaskId, 'failed', 0, t('upload.noFilesProcessed')); // New i18n key
    } else if (!overallBatchSuccess) {
        // Already marked as failed by sub-task or metadata error, or ensure it is
        if(finalBatchTask.error == null) // if not already set by subtask logic
          uploadStore.updateTaskStatus(batchTaskId, 'failed', finalBatchTask.progress, finalBatchTask.error || t('upload.batchFailed')); // New i18n key
    }
  }


  if (selectedFiles.value.length === 0 || (!anyFileProcessed && !overallBatchSuccess)) {
    // If no files were selected, or if files were selected but none processed AND the batch wasn't successful
    // This condition might need refinement based on when the dialog should close.
    // Generally, we want it to stay open if there was an attempt but it failed, to show errors.
    // It should close if the user cancels, or if everything is successful.
    if (selectedFiles.value.length === 0) emit('update:visible', false);
  }
  
  // Only set isLoading to false after all processing, including metadata update
  isLoading.value = false;
  
  // If all files were processed successfully and metadata updated, then close.
  // Otherwise, keep it open to show errors via the upload overlay.
  if (overallBatchSuccess && anyFileProcessed) {
    emit('update:visible', false);
  }
};

</script>

<style scoped>
.upload-local-files-dialog .local-file-uploader {
  width: 100%;
}
.upload-local-files-dialog :deep(.el-upload-dragger) {
  padding: 20px 10px;
}
.selected-files-preview {
  margin-top: 15px;
}
.selected-files-preview h4 {
  margin-bottom: 5px;
  font-size: 1em;
}
.loading-indicator {
  text-align: center;
  margin-bottom: 20px;
}
.loading-indicator p {
  margin-top: 10px;
  font-size: 0.9em;
  color: #888;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
