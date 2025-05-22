<template>
  <el-dialog
    :model-value="visible"
    title="编辑数据集详情"
    width="50%"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @open="onDialogOpen"
  >
    <div v-if="isLoadingDetails" class="dialog-loading-placeholder">
        <el-skeleton :rows="3" animated />
        加载数据集中...
    </div>
    <el-form v-else-if="datasetForm" :model="datasetForm" ref="editDatasetFormRef" label-width="100px">
      <el-form-item
        label="数据集名称"
        prop="name"
        :rules="[{ required: true, message: '数据集名称不能为空', trigger: 'blur' }]"
      >
        <el-input
          v-model="datasetForm.name"
          :maxlength="constraints.dataset.maxNameLength"
          show-word-limit
          placeholder="请输入数据集名称"
        />
      </el-form-item>
      <el-form-item label="数据集描述" prop="description">
        <el-input
          v-model="datasetForm.description"
          type="textarea"
          :rows="3"
          :maxlength="constraints.dataset.maxAbsLength"
          show-word-limit
          placeholder="请输入数据集描述"
        />
      </el-form-item>
      <el-form-item label="标签" prop="tags">
        <el-tag
          v-for="(tag, index) in datasetForm.tags"
          :key="index"
          closable
          @close="handleRemoveTag(index)"
          class="edit-dialog-tag"
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
          + 添加标签
        </el-button>
        <div class="tag-tip">
          最多添加 {{ constraints.tag.maxCount }} 个标签，单个标签长度不超过 {{ constraints.tag.maxLength }}，总长度不超过 {{ constraints.tag.maxLengthAll }}。
        </div>
      </el-form-item>
    </el-form>
    <div v-else class="dialog-error-placeholder">
        无法加载数据集详情。请关闭重试。
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" :disabled="isSaving">取消</el-button>
        <el-button type="primary" @click="handleSaveChanges" :loading="isSaving || isLoadingDetails">
          保存
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue';
import { ElDialog, ElForm, ElFormItem, ElInput, ElTag, ElButton, ElMessage, ElSkeleton } from 'element-plus';
import { useDatasetStore } from '@/stores/datasetStore';

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
        ElMessage.error("无法加载数据集数据以进行编辑。");
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
      ElMessage.warning(`单个标签长度不能超过 ${constraints.value.tag.maxLength} 个字符。`);
      val = val.slice(0, constraints.value.tag.maxLength);
    }
    if (datasetForm.value.tags.length >= constraints.value.tag.maxCount) {
      ElMessage.warning(`最多只能添加 ${constraints.value.tag.maxCount} 个标签。`);
      tagInputVisible.value = false;
      tagInputValue.value = '';
      return;
    }
    const currentTotalTagsLength = datasetForm.value.tags.join('').length;
    if (currentTotalTagsLength + val.length > constraints.value.tag.maxLengthAll && datasetForm.value.tags.length > 0) {
         ElMessage.warning(`所有标签总长度不能超过 ${constraints.value.tag.maxLengthAll} 个字符。`);
    } else if (!datasetForm.value.tags.includes(val)) {
      datasetForm.value.tags.push(val);
    }
  }
  tagInputVisible.value = false;
  tagInputValue.value = '';
};

const validateForm = () => {
  if (!datasetForm.value.name || datasetForm.value.name.trim() === '') {
    ElMessage.error('数据集名称不能为空。'); return false;
  }
  if (datasetForm.value.name.length > constraints.value.dataset.maxNameLength) {
    ElMessage.error(`数据集名称长度不能超过 ${constraints.value.dataset.maxNameLength}。`); return false;
  }
  if (datasetForm.value.description.length > constraints.value.dataset.maxAbsLength) {
    ElMessage.error(`数据集描述长度不能超过 ${constraints.value.dataset.maxAbsLength}。`); return false;
  }
  if (datasetForm.value.tags.length > constraints.value.tag.maxCount) {
    ElMessage.error(`标签数量不能超过 ${constraints.value.tag.maxCount}。`); return false;
  }
  for (const tag of datasetForm.value.tags) {
    if (tag.length > constraints.value.tag.maxLength) {
      ElMessage.error(`标签 '${tag}' 长度不能超过 ${constraints.value.tag.maxLength}。`); return false;
    }
  }
  if (datasetForm.value.tags.join('').length > constraints.value.tag.maxLengthAll) {
      ElMessage.error(`所有标签总长度不能超过 ${constraints.value.tag.maxLengthAll}。`); return false;
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
    ElMessage.success('数据集更新成功！');
    emit('update:visible', false); 
    // No need to emit 'dataset-updated', reactivity from store will handle UI updates
  } catch (error) {
    console.error('保存数据集失败:', error);
    ElMessage.error(`保存失败: ${error.message}`);
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
