<template>
  <el-dialog
    :model-value="visible"
    title="创建新数据集"
    width="50%"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @open="onDialogOpen"
    class="create-dataset-dialog"
  >
    <div v-if="isLoadingConstraints" class="dialog-loading-placeholder">
        <el-skeleton :rows="2" animated />
        加载约束条件...
    </div>
    <el-form v-else :model="datasetForm" ref="createDatasetFormRef" label-width="100px">
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
          + 添加标签
        </el-button>
        <div class="tag-tip">
          最多添加 {{ constraints.tag.maxCount }} 个标签，单个标签长度不超过 {{ constraints.tag.maxLength }}，总长度不超过 {{ constraints.tag.maxLengthAll }}。
        </div>
      </el-form-item>
      
      <el-form-item label="包含文件">
        <div v-if="filesForDataset && filesForDataset.length > 0" class="files-summary-in-dialog">
            <p>将包含 {{ filesForDataset.length }} 个文件:</p>
            <ul>
                <li v-for="file in filesForDataset.slice(0, 5)" :key="file.fileId">
                    {{ file.name || file.fileAbs }} <!-- Display name if available, else fileAbs -->
                </li>
                <li v-if="filesForDataset.length > 5">...等</li>
            </ul>
        </div>
        <div v-else>
            <p>无文件。这通常不应发生，请先选择文件。</p>
        </div>
      </el-form-item>

    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" :disabled="isCreating">取消</el-button>
        <el-button 
            type="primary" 
            @click="handleCreateDataset" 
            :loading="isCreating || isLoadingConstraints"
        >
          创建
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
      tagInputVisible.value = false; tagInputValue.value = ''; return;
    }
    const currentTotalTagsLength = datasetForm.value.tags.join('').length;
    if (currentTotalTagsLength + val.length > constraints.value.tag.maxLengthAll && datasetForm.value.tags.length > 0) {
         ElMessage.warning(`所有标签总长度不能超过 ${constraints.value.tag.maxLengthAll} 个字符。`);
    } else if (!datasetForm.value.tags.includes(val)) {
      datasetForm.value.tags.push(val);
    }
  }
  tagInputVisible.value = false; tagInputValue.value = '';
};

const validateForm = () => {
  if (!datasetForm.value.name || datasetForm.value.name.trim() === '') {
    ElMessage.error('数据集名称不能为空。'); return false;
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
    
    ElMessage.success('数据集创建成功！');
    emit('dataset-created'); // Inform parent (ExplorerPanel)
    emit('update:visible', false);
  } catch (error) {
    console.error('创建数据集失败:', error);
    ElMessage.error(`创建失败: ${error.message}`);
  } finally {
    isCreating.value = false;
  }
};

</script>

<style scoped>
.dialog-tag { margin-right: 5px; margin-bottom: 5px; }
.tag-input { width: 120px; margin-right: 5px; vertical-align: bottom; }
.button-new-tag { height: 32px; line-height: 30px; padding-top: 0; padding-bottom: 0; }
.tag-tip { font-size: 12px; color: #909399; margin-top: 5px; line-height: 1.2; }
.dialog-loading-placeholder { padding: 20px; text-align: center; color: #909399; }
.files-summary-in-dialog {
    font-size: 13px;
    color: #606266; /* Element Plus default text color */
}
.files-summary-in-dialog ul {
    list-style-type: disc;
    padding-left: 20px;
    max-height: 80px; /* Limit height for long lists */
    overflow-y: auto;
}
.files-summary-in-dialog li {
    margin-bottom: 3px;
}

/* Dark theme considerations */
.create-dataset-dialog :deep(.el-dialog__body) {
  /* background-color: #2a2a2a; */
}
.create-dataset-dialog :deep(.el-form-item__label) {
  /* color: #c0c0c0; */
}
</style>
