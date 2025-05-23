<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('dataset.createEmpty')"
    width="500px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    class="create-empty-dataset-dialog"
  >
    <div v-if="isLoading" class="loading-state">
      <el-skeleton :rows="3" animated />
      {{ t('dataset.loadingDetails') }}
    </div>
    <el-form
      v-else
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      @submit.prevent="handleSubmit"
    >
      <el-form-item :label="t('dataset.name')" prop="name">
        <el-input
          v-model="form.name"
          :placeholder="t('dataset.namePlaceholder')"
          :maxlength="50"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('dataset.description')" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :placeholder="t('dataset.descriptionPlaceholder')"
          :maxlength="200"
          show-word-limit
          :rows="3"
        />
      </el-form-item>

      <el-form-item :label="t('dataset.tags')" prop="tags">
        <div class="tags-container">
          <el-tag
            v-for="tag in form.tags"
            :key="tag"
            closable
            @close="handleRemoveTag(tag)"
            class="tag-item"
          >
            {{ tag }}
          </el-tag>
          <el-input
            v-if="inputVisible"
            ref="tagInputRef"
            v-model="inputValue"
            class="tag-input"
            size="small"
            @keyup.enter="handleInputConfirm"
            @blur="handleInputConfirm"
          />
          <el-button v-else class="button-new-tag" size="small" @click="showInput">
            {{ t('dataset.addTag') }}
          </el-button>
        </div>
        <div class="tag-tip">{{ t('dataset.tagTip', { maxCount: 5, maxLength: 20, maxLengthAll: 100 }) }}</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="isSubmitting">
          {{ t('common.save') }}
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
  visible: Boolean
});

const emit = defineEmits(['update:visible', 'dataset-created']);

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const formRef = ref(null);
const isLoading = ref(false);
const isSubmitting = ref(false);

const form = ref({
  name: '',
  description: '',
  tags: []
});

const rules = {
  name: [
    { required: true, message: t('dataset.nameRequired'), trigger: 'blur' },
    { max: 50, message: t('dataset.nameTooLong', { maxLength: 50 }), trigger: 'blur' }
  ],
  description: [
    { max: 200, message: t('dataset.descriptionTooLong', { maxLength: 200 }), trigger: 'blur' }
  ]
};

const inputVisible = ref(false);
const inputValue = ref('');
const tagInputRef = ref(null);

const showInput = () => {
  inputVisible.value = true;
  nextTick(() => {
    tagInputRef.value?.focus();
  });
};

const handleInputConfirm = () => {
  if (inputValue.value) {
    if (form.value.tags.length >= 5) {
      ElMessage.warning(t('dataset.tooManyTags', { maxCount: 5 }));
      return;
    }
    if (inputValue.value.length > 20) {
      ElMessage.warning(t('dataset.tagTooLong', { tag: inputValue.value, maxLength: 20 }));
      return;
    }
    const totalLength = form.value.tags.reduce((acc, tag) => acc + tag.length, 0) + inputValue.value.length;
    if (totalLength > 100) {
      ElMessage.warning(t('dataset.tagsTotalTooLong', { maxLengthAll: 100 }));
      return;
    }
    form.value.tags.push(inputValue.value);
  }
  inputVisible.value = false;
  inputValue.value = '';
};

const handleRemoveTag = (tag) => {
  form.value.tags = form.value.tags.filter(t => t !== tag);
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
    name: '',
    description: '',
    tags: []
  };
  inputVisible.value = false;
  inputValue.value = '';
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
    isSubmitting.value = true;

    const result = await datasetStore.createEmptyDataset({
      name: form.value.name,
      description: form.value.description,
      tags: form.value.tags
    });

    ElMessage.success(t('dataset.createSuccess'));
    emit('dataset-created', result);
    handleCancel();
  } catch (error) {
    if (error === 'cancel') return;
    ElMessage.error(t('dataset.createFailed'));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.create-empty-dataset-dialog :deep(.el-dialog__body) {
  padding: 20px;
}

.loading-state {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.tag-item {
  margin-right: 8px;
  margin-bottom: 8px;
}

.tag-input {
  width: 100px;
  margin-right: 8px;
  vertical-align: bottom;
}

.button-new-tag {
  margin-bottom: 8px;
}

.tag-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
