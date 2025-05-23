<template>
  <el-dialog
    :model-value="visible"
    :title="t('dataset.createTitle')"
    width="50%"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @open="onDialogOpen"
    class="create-dataset-dialog"
  >
    <div v-if="isLoadingConstraints" class="dialog-loading-placeholder">
        <el-skeleton :rows="2" animated />
        {{ t('dataset.loadingConstraints') }}
    </div>
    <el-form v-else :model="datasetForm" ref="createDatasetFormRef" label-width="100px">
      <el-form-item
        :label="t('dataset.name')"
        prop="name"
        :rules="[{ required: true, message: t('dataset.nameRequired'), trigger: 'blur' }]"
      >
        <el-input
          v-model="datasetForm.name"
          :maxlength="constraints.dataset.maxNameLength"
          show-word-limit
          :placeholder="t('dataset.namePlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('dataset.description')" prop="description">
        <el-input
          v-model="datasetForm.description"
          type="textarea"
          :rows="3"
          :maxlength="constraints.dataset.maxAbsLength"
          show-word-limit
          :placeholder="t('dataset.descriptionPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('dataset.tags')" prop="tags">
        <el-tag
          v-for="(tag, index) in datasetForm.tags"
          :key="index"
          closable
          @close="handleRemoveTag(index)"
          class="dialog-tag"
        >
          {{ tag }}
        </el-tag>
        <el-input
          v-if="tagInputVisible"
          ref="tagInputRef"
          v-model="tagInputValue"
          class="tag-input"
          size="small"
          @keyup.enter="handleAddTag"
          @blur="handleAddTag"
          :maxlength="constraints.tag.maxLength"
        />
        <el-button
          v-else
          class="button-new-tag"
          size="small"
          @click="showTagInput"
          :disabled="datasetForm.tags.length >= constraints.tag.maxCount"
        >
          {{ t('dataset.addTag') }}
        </el-button>
        <div class="tag-tip">
          {{ t('dataset.tagTip', { maxCount: constraints.tag.maxCount, maxLength: constraints.tag.maxLength, maxLengthAll: constraints.tag.maxLengthAll }) }}
        </div>
      </el-form-item>
      
      <el-form-item :label="t('dataset.files')">
        <div v-if="filesForDataset && filesForDataset.length > 0" class="files-summary-in-dialog">
            <p>{{ t('dataset.filesSummary', { count: filesForDataset.length }) }}</p>
            <ul>
                <li v-for="file in filesForDataset.slice(0, 5)" :key="file.fileId">
                    {{ file.name || file.fileAbs }}
                </li>
                <li v-if="filesForDataset.length > 5">{{ t('dataset.moreFiles') }}</li>
            </ul>
        </div>
        <div v-else>
            <p>{{ t('dataset.noFiles') }}</p>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="isSubmitting">
          {{ t('common.confirm') }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue';
import { ElDialog, ElForm, ElFormItem, ElInput, ElTag, ElButton, ElMessage, ElSkeleton } from 'element-plus';
import { useDatasetStore } from '@/stores/datasetStore';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  visible: Boolean,
  filesForDataset: { // Array of { fileId, fileAbs, name? }
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:visible', 'dataset-created']);

const datasetStore = useDatasetStore();
const createDatasetFormRef = ref(null);
const datasetForm = ref({
  name: '',
  description: '',
  tags: [],
});
const isCreating = ref(false);
const isLoadingConstraints = ref(false);

const constraints = computed(() => datasetStore.datasetConstraints || {
  dataset: { maxNameLength: 100, maxAbsLength: 200 },
  tag: { maxLength: 20, maxLengthAll: 127, maxCount: 5 }
});

const tagInputVisible = ref(false);
const tagInputValue = ref('');
const tagInputRef = ref(null);

const resetForm = () => {
    datasetForm.value = {
        name: `新数据集_${new Date().toISOString().slice(0, 10)}`, // Default name
        description: '',
        tags: [],
    };
    if (createDatasetFormRef.value) {
        createDatasetFormRef.value.clearValidate();
    }
};

const onDialogOpen = async () => {
  isLoadingConstraints.value = true;
  if (!datasetStore.datasetConstraints) {
    await datasetStore.fetchDatasetConstraints();
  }
  resetForm();
  isLoadingConstraints.value = false;
};

watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    onDialogOpen();
  }
});

const handleRemoveTag = (index) => {
  datasetForm.value.tags.splice(index, 1);
};

const showTagInput = () => {
  if (datasetForm.value.tags.length < constraints.value.tag.maxCount) {
    tagInputVisible.value = true;
    nextTick(() => { tagInputRef.value?.focus(); });
  } else {
    ElMessage.warning(t('dataset.tooManyTags', { maxCount: constraints.value.tag.maxCount }));
  }
};

const handleAddTag = () => {
  let val = tagInputValue.value.trim();
  if (val) {
    if (val.length > constraints.value.tag.maxLength) {
      ElMessage.warning(t('dataset.tagTooLong', { maxLength: constraints.value.tag.maxLength }));
      val = val.slice(0, constraints.value.tag.maxLength);
    }
    if (datasetForm.value.tags.length >= constraints.value.tag.maxCount) {
      ElMessage.warning(t('dataset.tooManyTags', { maxCount: constraints.value.tag.maxCount }));
      tagInputVisible.value = false; tagInputValue.value = ''; return;
    }
    const currentTotalTagsLength = datasetForm.value.tags.join('').length;
    if (currentTotalTagsLength + val.length > constraints.value.tag.maxLengthAll && datasetForm.value.tags.length > 0) {
         ElMessage.warning(t('dataset.tagsTotalTooLong', { maxLengthAll: constraints.value.tag.maxLengthAll }));
    } else if (!datasetForm.value.tags.includes(val)) {
      datasetForm.value.tags.push(val);
    }
  }
  tagInputVisible.value = false; tagInputValue.value = '';
};

const validateForm = () => {
  if (!datasetForm.value.name || datasetForm.value.name.trim() === '') {
    ElMessage.error(t('dataset.nameRequired')); return false;
  }
  // Additional validations based on constraints... (similar to EditDatasetDialog)
  return true;
};

const handleCreateDataset = async () => {
  if (!validateForm()) {
    return;
  }

  isCreating.value = true;
  try {
    const datasetDetails = {
      name: datasetForm.value.name,
      abs: datasetForm.value.description,
      tags: datasetForm.value.tags,
    };
    // filesForDataset prop should already contain { fileId, fileAbs }
    await datasetStore.createNewDataset(datasetDetails, props.filesForDataset || []);
    
    ElMessage.success(t('dataset.createSuccess'));
    emit('dataset-created'); // Inform parent (ExplorerPanel)
    emit('update:visible', false);
  } catch (error) {
    console.error(t('dataset.createFailed'), error);
    ElMessage.error(`${t('dataset.createFailed')}: ${error.message}`);
  } finally {
    isCreating.value = false;
  }
};

</script>

<style scoped>
.dialog-tag {
  margin-right: 5px;
  margin-bottom: 5px;
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color-light);
}

.tag-input {
  width: 120px;
  margin-right: 5px;
  vertical-align: bottom;
}

.button-new-tag {
  height: 32px;
  line-height: 30px;
  padding-top: 0;
  padding-bottom: 0;
}

.tag-tip {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 5px;
  line-height: 1.2;
}

.dialog-loading-placeholder {
  padding: 20px;
  text-align: center;
  color: var(--el-text-color-regular);
}

.files-summary-in-dialog {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.files-summary-in-dialog ul {
  list-style-type: disc;
  padding-left: 20px;
  max-height: 80px;
  overflow-y: auto;
}

.files-summary-in-dialog li {
  margin-bottom: 3px;
}

:deep(.el-dialog__body) {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

:deep(.el-form-item__label) {
  color: var(--el-text-color-primary);
}

:deep(.el-input__inner) {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color-light);
}

:deep(.el-input__inner:focus) {
  border-color: var(--el-color-primary);
}

:deep(.el-textarea__inner) {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color-light);
}

:deep(.el-textarea__inner:focus) {
  border-color: var(--el-color-primary);
}
</style>
