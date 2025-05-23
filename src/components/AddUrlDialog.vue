<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('file.addUrlFile')"
    width="500px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="add-url-dialog"
  >
    <div v-if="isLoading" class="loading-state">
      <el-skeleton :rows="3" animated />
      {{ t('file.fetching') }}
    </div>
    <el-form
      v-else
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      @submit.prevent="handleSubmit"
    >
      <el-form-item :label="t('file.url')" prop="url">
        <el-input
          v-model="form.url"
          :placeholder="t('file.urlPlaceholder')"
          :disabled="isLoading"
        />
      </el-form-item>

      <el-form-item :label="t('file.name')" prop="name">
        <el-input
          v-model="form.name"
          :placeholder="t('file.namePlaceholder')"
          :disabled="isLoading"
        />
      </el-form-item>

      <el-form-item :label="t('file.referer')" prop="referer">
        <el-input
          v-model="form.referer"
          :placeholder="t('file.refererPlaceholder')"
          :disabled="isLoading"
        />
      </el-form-item>

      <el-form-item :label="t('file.userAgent')" prop="userAgent">
        <el-input
          v-model="form.userAgent"
          :placeholder="t('file.userAgentPlaceholder')"
          :disabled="isLoading"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="isSubmitting">
          {{ t('file.fetchAndAdd') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElButton, ElSkeleton } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useDatasetStore } from '@/stores/datasetStore';
import { useUploadStore } from '@/stores/uploadStore'; // Import upload store
import * as apiService from '@/services/apiService'; // Import apiService
import { v4 as uuidv4 } from 'uuid'; // Import uuid

const { t } = useI18n();
const datasetStore = useDatasetStore();
const uploadStore = useUploadStore(); // Initialize upload store

const props = defineProps({
  visible: Boolean,
  datasetId: {
    type: [String, Number],
    required: true
  },
  datasetName: { // Added datasetName prop
    type: String,
    default: ''
  },
  basePathInDataset: { // Added basePathInDataset prop (though less relevant for URL, good for consistency)
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:visible', 'file-added']);

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const formRef = ref(null);
const isLoading = ref(false);
const isSubmitting = ref(false);

const form = ref({
  url: '',
  name: '',
  referer: '',
  userAgent: ''
});

const rules = {
  url: [
    { required: true, message: t('file.urlRequired'), trigger: 'blur' },
    { type: 'url', message: t('file.invalidUrl'), trigger: 'blur' }
  ],
  name: [
    { required: true, message: t('file.nameRequired'), trigger: 'blur' }
  ]
};

const handleCancel = () => {
  dialogVisible.value = false;
  resetForm();
};

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields();
  }
  form.value = {
    url: '',
    name: '',
    referer: '',
    userAgent: ''
  };
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  await formRef.value.validate(); // Validation will throw if it fails
  isSubmitting.value = true;
  isLoading.value = true; // Also set isLoading for overall dialog state

  const taskId = uuidv4();
  uploadStore.addTask({
    id: taskId,
    name: form.value.name,
    type: 'file', // URL fetch results in a single file
    uploadType: 'url-fetch',
    targetDatasetId: props.datasetId,
    targetDatasetName: props.datasetName || String(props.datasetId),
    status: 'uploading', // Indicate fetching has started
    progress: 0, // Indeterminate for URL fetch initially
  });

  try {
    const payload = {
      url: form.value.url,
      fileName: form.value.name,
      referer: form.value.referer,
      userAgent: form.value.userAgent,
      datasetId: props.datasetId,
      // basePathInDataset might be relevant if API supports placing URL files in specific paths
      // For now, assuming it's added to dataset root or API handles pathing if basePathInDataset is part of payload
    };
    if (props.basePathInDataset) {
        payload.basePath = props.basePathInDataset;
    }

    const result = await apiService.fetchUrlToDataset(payload);

    // After successful API call, update the task in uploadStore
    uploadStore.updateTaskStatus(taskId, 'completed', 100, null, { 
      fileId: result.fileId, 
      fileAbs: result.fileAbs || form.value.name // Use form.name as fallback for fileAbs
    });
    
    // Add file to dataset in datasetStore (this might be redundant if fetchUrlToDataset already does it,
    // but good for explicit state management if fetchUrlToDataset only handles backend registration)
    // Assuming addUrlFile in datasetStore is still the primary way to update dataset's frontend state.
    // The `result` from `fetchUrlToDataset` should contain necessary info.
     await datasetStore.addUrlFile({
        datasetId: props.datasetId,
        fileId: result.fileId,
        fileAbs: result.fileAbs,
        name: form.value.name, // from form
        size: result.size || 0, // from result if available
        // other potential fields like type, etc.
    });


    ElMessage.success(t('file.urlFileSuccess', { name: form.value.name }));
    emit('file-added', { fileId: result.fileId, fileAbs: result.fileAbs || form.value.name, name: form.value.name });
    handleCancel();

  } catch (error) {
    console.error('Error fetching URL file:', error);
    uploadStore.updateTaskStatus(taskId, 'failed', 0, error.message || t('file.urlFileFailed', { error: 'Unknown' }));
    ElMessage.error(t('file.urlFileFailed', { error: error.message || t('error.operationFailed') }));
    // Do not automatically cancel the dialog on error, let user see the error in upload overlay
  } finally {
    isSubmitting.value = false;
    isLoading.value = false;
  }
};
</script>

<style scoped>
.add-url-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.loading-state {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
