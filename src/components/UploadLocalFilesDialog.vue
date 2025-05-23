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
});

const emit = defineEmits(['update:visible', 'files-added']);

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
  const isFolderUpload = selectedFiles.value.some(f => f.relativePath) || selectedFiles.value.length > 1;
  const batchTaskName = isFolderUpload ? 
    (selectedFiles.value[0]?.relativePath.split('/')[0] || t('upload.multiFileUpload', { name: props.datasetName })) : 
    (selectedFiles.value[0]?.name || t('upload.fileUpload', { name: props.datasetName }));

  uploadStore.addTask({
    id: batchTaskId,
    name: batchTaskName,
    type: isFolderUpload ? 'folder' : 'file',
    status: 'uploading',
    progress: 0,
    totalSize: selectedFiles.value.reduce((acc, f) => acc + (f.size || 0), 0),
    itemCount: totalFilesToUploadCount.value,
  });

  for (const fileObj of selectedFiles.value) {
    currentUploadingFile.value = fileObj.name;
    uploadStore.updateTaskStatus(batchTaskId, 'uploading', uploadProgress.value);

    try {
      const formData = new FormData();
      formData.append('file', fileObj.raw);
      
      const response = await apiService.uploadLocalFile(formData); 
      if (response.success && response.fileId) {
        let finalFileAbs = response.fileAbs; 
        if (props.basePathInDataset) {
          finalFileAbs = `${props.basePathInDataset.replace(/^\/+|\/+$/g, '')}/${finalFileAbs}`;
        }
        if (fileObj.relativePath) {
            const dirPath = fileObj.relativePath.substring(0, fileObj.relativePath.lastIndexOf('/'));
            if(dirPath) {
                 finalFileAbs = props.basePathInDataset 
                                ? `${props.basePathInDataset.replace(/^\/+|\/+$/g, '')}/${dirPath}/${fileObj.name}`
                                : `${dirPath}/${fileObj.name}`;
            } else { 
                 finalFileAbs = props.basePathInDataset
                                ? `${props.basePathInDataset.replace(/^\/+|\/+$/g, '')}/${fileObj.name}`
                                : fileObj.name;
            }
        }
        finalFileAbs = finalFileAbs.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        uploadedFileResults.push({ fileId: response.fileId, fileAbs: finalFileAbs });
        anyFileProcessed = true;
      } else {
        ElMessage.error(`文件 ${fileObj.name} 上传失败: ${response.error || '未知错误'}`);
        overallSuccess = false;
      }
    } catch (error) {
      ElMessage.error(`文件 ${fileObj.name} 上传出错: ${error.message || '网络错误'}`);
      overallSuccess = false;
    }
    filesProcessedCount.value++;
    uploadProgress.value = Math.round((filesProcessedCount.value / totalFilesToUploadCount.value) * 100);
    uploadStore.updateTaskStatus(batchTaskId, 'uploading', uploadProgress.value);
  }
  currentUploadingFile.value = '';

  if (uploadedFileResults.length > 0) {
    try {
      const dataset = datasetStore.getDatasetById(props.datasetId);
      if (!dataset) {
        throw new Error('目标数据集信息未找到。');
      }

      // 确保数据集信息完整
      const existingDatasetData = {
        datasetName: dataset.label || dataset.name || props.datasetName,
        datasetAbs: dataset.description || dataset.abs || '数据集描述',
        tags: dataset.tags || [],
        ispublic: dataset.ispublic !== undefined ? dataset.ispublic : 0,
        fileIds: dataset.fileIds || [],
        fileAbsList: dataset.fileAbsList || [],
      };

      // 添加文件到数据集
      await datasetStore.addFilesToDataset({
        datasetId: props.datasetId,
        newFilesData: uploadedFileResults,
        existingDatasetData: existingDatasetData,
      });

      // 触发文件添加事件
      emit('files-added');
      
      if (overallSuccess) {
        uploadStore.updateTaskStatus(batchTaskId, 'completed', 100);
        ElMessage.success(`批处理任务完成: ${uploadedFileResults.length} 个文件成功添加到 ${props.datasetName}。`);
      } else {
        const errorMsg = `批处理任务部分或完全失败。成功: ${uploadedFileResults.length}/${totalFilesToUploadCount.value}`;
        uploadStore.updateTaskStatus(batchTaskId, 'failed', uploadProgress.value, errorMsg);
        ElMessage.warning(errorMsg);
      }
    } catch (error) {
      console.error('添加到数据集失败:', error);
      ElMessage.error(`添加到数据集失败: ${error.message || '未知错误'}`);
      overallSuccess = false;
      uploadStore.updateTaskStatus(batchTaskId, 'failed', uploadProgress.value, error.message);
    }
  }
  
  if (!anyFileProcessed && selectedFiles.value.length > 0) {
    overallSuccess = false;
  }

  if (selectedFiles.value.length === 0 || (!anyFileProcessed && !overallSuccess)) {
    emit('update:visible', false);
  }
  isLoading.value = false;
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
