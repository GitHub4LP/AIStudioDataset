<template>
  <el-dialog
    :model-value="visible"
    title="创建新空数据集"
    width="500px"
    @update:model-value="$emit('update:visible', $event)"
    @closed="resetForm"
    :close-on-click-modal="false"
    class="create-empty-dataset-dialog"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
      <el-form-item label="数据集名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入数据集名称" />
      </el-form-item>
      <el-form-item label="数据集描述" prop="abs">
        <el-input
          v-model="form.abs"
          type="textarea"
          :rows="3"
          placeholder="请输入数据集描述 (可选)"
        />
      </el-form-item>
      <el-form-item label="标签 (可选)" prop="tags">
        <el-select
          v-model="form.tags"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="添加或选择标签"
          no-data-text="无可用标签，可输入新标签创建"
          class="tag-select"
        >
          <el-option
            v-for="item in existingTags"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)">取消</el-button>
        <el-button type="primary" @click="handleCreateEmptyDataset" :loading="isLoading">
          创建
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElButton, ElMessage } from 'element-plus';
import { useDatasetStore } from '@/stores/datasetStore';

const props = defineProps({
  visible: Boolean,
});

const emit = defineEmits(['update:visible', 'dataset-created']);

const datasetStore = useDatasetStore();
const formRef = ref(null);
const isLoading = ref(false);

const form = reactive({
  name: '',
  abs: '',
  tags: [],
});

const rules = reactive({
  name: [
    { required: true, message: '请输入数据集名称', trigger: 'blur' },
    // Add more validation rules if needed from datasetConstraints
    {
      validator: (rule, value, callback) => {
        if (datasetStore.datasetConstraints?.dataset?.maxNameLength && value.length > datasetStore.datasetConstraints.dataset.maxNameLength) {
          callback(new Error(`名称长度不能超过 ${datasetStore.datasetConstraints.dataset.maxNameLength} 个字符`));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  abs: [
    {
      validator: (rule, value, callback) => {
        if (datasetStore.datasetConstraints?.dataset?.maxAbsLength && value.length > datasetStore.datasetConstraints.dataset.maxAbsLength) {
          callback(new Error(`描述长度不能超过 ${datasetStore.datasetConstraints.dataset.maxAbsLength} 个字符`));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  tags: [
    {
      validator: (rule, value, callback) => {
        if (datasetStore.datasetConstraints?.tag) {
          const { maxCount, maxLength, maxLengthAll } = datasetStore.datasetConstraints.tag;
          if (value.length > maxCount) {
            return callback(new Error(`最多允许 ${maxCount} 个标签`));
          }
          if (value.some(tag => tag.length > maxLength)) {
            return callback(new Error(`单个标签长度不能超过 ${maxLength} 个字符`));
          }
          if (value.join(',').length > maxLengthAll) {
             return callback(new Error(`所有标签总长度不能超过 ${maxLengthAll} 个字符 (包含分隔符)`));
          }
        }
        callback();
      },
      trigger: 'change', // Validate on change for tags
    },
  ],
});

// Placeholder for existing tags - ideally, this would come from a shared source or store
const existingTags = computed(() => {
  // Example: aggregate tags from existing datasets or a predefined list
  const tags = new Set();
  datasetStore.datasets.forEach(ds => {
    (ds.tags || []).forEach(tag => tags.add(tag));
  });
  return Array.from(tags).map(tag => ({ label: tag, value: tag }));
});


const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields();
  }
  form.name = '';
  form.abs = '';
  form.tags = [];
};

const handleCreateEmptyDataset = async () => {
  if (!formRef.value) return;
  formRef.value.validate(async (valid) => {
    if (valid) {
      isLoading.value = true;
      try {
        // Call store action to create a new dataset with empty file lists
        const datasetDetails = {
          name: form.name,
          abs: form.abs,
          tags: form.tags,
        };
        // The filesList is an empty array for an empty dataset
        await datasetStore.createNewDataset(datasetDetails, []); 
        
        ElMessage.success('空数据集创建成功！');
        emit('dataset-created');
        emit('update:visible', false);
      } catch (error) {
        console.error('创建空数据集失败:', error);
        ElMessage.error(`创建失败: ${error.message || '未知错误'}`);
      } finally {
        isLoading.value = false;
      }
    } else {
      ElMessage.error('请检查表单输入。');
      return false;
    }
  });
};

</script>

<style scoped>
.create-empty-dataset-dialog .tag-select {
  width: 100%;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
/* Add any other specific styles */
</style>
