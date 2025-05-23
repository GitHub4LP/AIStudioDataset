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
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useDatasetStore } from '@/stores/datasetStore';

const { t } = useI18n();
const datasetStore = useDatasetStore();

const props = defineProps({
  visible: Boolean,
  datasetId: {
    type: [String, Number],
    required: true
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
  
  try {
    await formRef.value.validate();
    isSubmitting.value = true;

    const result = await datasetStore.addUrlFile({
      datasetId: props.datasetId,
      url: form.value.url,
      name: form.value.name,
      referer: form.value.referer,
      userAgent: form.value.userAgent
    });

    ElMessage.success(t('file.addSuccess'));
    emit('file-added', result);
    handleCancel();
  } catch (error) {
    if (error === 'cancel') return;
    ElMessage.error(t('file.addFailed'));
  } finally {
    isSubmitting.value = false;
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
