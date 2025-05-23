<template>
  <el-dialog
    :model-value="visible"
    :title="t('dataset.editTitle')"
    width="50%"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @open="onDialogOpen"
  >
    <div v-if="isLoadingDetails" class="dialog-loading-placeholder">
        <el-skeleton :rows="3" animated />
        {{ t('dataset.loadingDetails') }}
    </div>
    <el-form v-else-if="datasetForm" :model="datasetForm" ref="editDatasetFormRef" label-width="100px">
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
    </el-form>
    <div v-else class="dialog-error-placeholder">
        无法加载数据集详情。请关闭重试。
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" :disabled="isSaving">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" @click="handleSaveChanges" :loading="isSaving || isLoadingDetails">
          {{ t('common.save') }}
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
  datasetId: { // Changed from 'dataset' object to 'datasetId'
    type: String,
    default: null
  }
});

const emit = defineEmits(['update:visible']); // Removed 'dataset-updated'

const datasetStore = useDatasetStore();
const editDatasetFormRef = ref(null);
const datasetForm = ref(null); // Will hold { name, description, tags, fileIds, fileAbsList, ispublic }
const isSaving = ref(false);
const isLoadingDetails = ref(false);


// Use a computed property for constraints for easier access
const constraints = computed(() => datasetStore.datasetConstraints || {
  dataset: { maxNameLength: 100, maxAbsLength: 200 },
  tag: { maxLength: 20, maxLengthAll: 127, maxCount: 5 }
});

const tagInputVisible = ref(false);
const tagInputValue = ref('');
const tagInputRef = ref(null);

const initializeFormWithDataset = (datasetDetails) => {
    if (datasetDetails) {
        datasetForm.value = {
            name: datasetDetails.label || datasetDetails.datasetName || '',
            description: datasetDetails.description || datasetDetails.datasetAbs || '',
            tags: datasetDetails.tags ? [...datasetDetails.tags] : [],
            // Crucial: These must be from the authoritative source (store's detailed dataset)
            fileIds: datasetDetails.fileIds || [],
            fileAbsList: datasetDetails.fileAbsList || [],
            ispublic: datasetDetails.ispublic !== undefined ? datasetDetails.ispublic : 0,
        };
    } else {
        // Fallback or error state if dataset details are not available
        datasetForm.value = { name: '', description: '', tags: [], fileIds: [], fileAbsList: [], ispublic: 0 };
        ElMessage.error(t('error.loadDatasetFailed'));
    }
    if (editDatasetFormRef.value) {
        editDatasetFormRef.value.clearValidate();
    }
};

const onDialogOpen = async () => {
  if (!props.datasetId) {
    datasetForm.value = null; // Clear form if no ID
    return;
  }
  isLoadingDetails.value = true;
  // Fetch or get from cache
  let_datasetDetails = datasetStore.getDatasetById(props.datasetId);
  if (!_datasetDetails || !_datasetDetails.children) { // Check if children (fileList) are loaded
      // console.log(`EditDialog: Fetching details for ${props.datasetId}`);
      _datasetDetails = await datasetStore.fetchDatasetDetails(props.datasetId, true); // Force fetch if not fully loaded
  }
  
  initializeFormWithDataset(_datasetDetails);
  isLoadingDetails.value = false;
};

// Watch for visibility and datasetId changes
watch(() => [props.visible, props.datasetId], ([newVisible, newId]) => {
  if (newVisible && newId) {
    onDialogOpen();
  } else if (!newVisible) {
    datasetForm.value = null; // Clear form when dialog is hidden
  }
}, { immediate: true });


const handleRemoveTag = (index) => {
  datasetForm.value.tags.splice(index, 1);
};

const showTagInput = () => {
  if (datasetForm.value.tags.length < constraints.value.tag.maxCount) {
    tagInputVisible.value = true;
    nextTick(() => {
      tagInputRef.value?.focus();
    });
  } else {
    ElMessage.warning(`最多只能添加 ${constraints.value.tag.maxCount} 个标签。`);
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
      tagInputVisible.value = false;
      tagInputValue.value = '';
      return;
    }
    const currentTotalTagsLength = datasetForm.value.tags.join('').length;
    if (currentTotalTagsLength + val.length > constraints.value.tag.maxLengthAll && datasetForm.value.tags.length > 0) {
      ElMessage.warning(t('dataset.tagsTotalTooLong', { maxLengthAll: constraints.value.tag.maxLengthAll }));
    } else if (!datasetForm.value.tags.includes(val)) {
      datasetForm.value.tags.push(val);
    }
  }
  tagInputVisible.value = false;
  tagInputValue.value = '';
};

const validateForm = () => {
  if (!datasetForm.value.name || datasetForm.value.name.trim() === '') {
    ElMessage.error(t('dataset.nameRequired')); return false;
  }
  if (datasetForm.value.name.length > constraints.value.dataset.maxNameLength) {
    ElMessage.error(t('dataset.nameTooLong', { maxLength: constraints.value.dataset.maxNameLength })); return false;
  }
  if (datasetForm.value.description.length > constraints.value.dataset.maxAbsLength) {
    ElMessage.error(t('dataset.descriptionTooLong', { maxLength: constraints.value.dataset.maxAbsLength })); return false;
  }
  if (datasetForm.value.tags.length > constraints.value.tag.maxCount) {
    ElMessage.error(t('dataset.tooManyTags', { maxCount: constraints.value.tag.maxCount })); return false;
  }
  for (const tag of datasetForm.value.tags) {
    if (tag.length > constraints.value.tag.maxLength) {
      ElMessage.error(t('dataset.tagTooLong', { tag, maxLength: constraints.value.tag.maxLength })); return false;
    }
  }
  if (datasetForm.value.tags.join('').length > constraints.value.tag.maxLengthAll) {
    ElMessage.error(t('dataset.tagsTotalTooLong', { maxLengthAll: constraints.value.tag.maxLengthAll })); return false;
  }
  return true;
};

const handleSaveChanges = async () => {
  if (!validateForm()) return;

  isSaving.value = true;
  try {
    const payload = {
      datasetName: datasetForm.value.name,
      datasetAbs: datasetForm.value.description,
      tags: datasetForm.value.tags,
      fileIds: datasetForm.value.fileIds, // These must be from the loaded dataset details
      fileAbsList: datasetForm.value.fileAbsList,
      ispublic: datasetForm.value.ispublic,
    };
    
    await datasetStore.updateDataset({ datasetId: props.datasetId, data: payload });
    ElMessage.success(t('dataset.updateSuccess'));
    emit('update:visible', false); 
    // No need to emit 'dataset-updated', reactivity from store will handle UI updates
  } catch (error) {
    console.error(t('dataset.updateFailed'), error);
    ElMessage.error(`${t('dataset.updateFailed')}: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};

</script>

<style scoped>
.edit-dialog-tag { margin-right: 5px; margin-bottom: 5px; }
.tag-input { width: 120px; margin-right: 5px; vertical-align: bottom; }
.button-new-tag { height: 32px; line-height: 30px; padding-top: 0; padding-bottom: 0; }
.tag-tip { font-size: 12px; color: #909399; margin-top: 5px; line-height: 1.2; }
.dialog-loading-placeholder, .dialog-error-placeholder { padding: 20px; text-align: center; color: #909399; }

/* Dark theme adjustments if needed for dialog elements */
:deep(.el-dialog__body) {
  /* background-color: #2a2a2a; */
  /* color: #e0e0e0; */
}
:deep(.el-form-item__label) {
  /* color: #c0c0c0; */
}
</style>
