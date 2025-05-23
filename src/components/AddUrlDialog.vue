<template>
  <el-dialog
    :model-value="visible"
    :title="`通过URL添加文件到: ${datasetName}`"
    width="600px"
    @update:model-value="$emit('update:visible', $event)"
    @closed="resetForm"
    :close-on-click-modal="!isLoading"
    :close-on-press-escape="!isLoading"
    class="add-url-dialog"
  >
    <div v-if="isLoading && currentTaskId" class="loading-indicator">
      <el-progress
        :text-inside="true"
        :stroke-width="20"
        :percentage="uploadStore.tasks.find(t => t.id === currentTaskId)?.progress || 0"
        :status="uploadStore.tasks.find(t => t.id === currentTaskId)?.status === 'failed' ? 'exception' : 'success'"
      />
      <p>{{ loadingMessage || uploadStore.tasks.find(t => t.id === currentTaskId)?.status }}</p>
    </div>

    <el-form :model="form" :rules="rules" ref="formRef" label-position="top" :disabled="isLoading">
      <el-form-item label="目标路径 (数据集内)" v-if="basePathInDataset">
        <el-input :value="basePathInDataset" disabled />
      </el-form-item>
      
      <el-form-item label="文件URL" prop="url">
        <el-input v-model="form.url" placeholder="请输入文件的URL (http(s)://...)" @blur="attemptAutoFillFileName" />
      </el-form-item>

      <el-form-item label="文件名" prop="fileName">
        <el-input v-model="form.fileName" placeholder="请输入保存的文件名 (例如: image.jpg)">
          <template #append>
            <el-button @click="attemptAutoFillFileName" :disabled="!form.url">从URL获取</el-button>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="Referer (可选)" prop="referer">
        <el-input v-model="form.referer" placeholder="请输入Referer" />
      </el-form-item>

      <el-form-item label="User-Agent (可选)" prop="userAgent">
        <el-input v-model="form.userAgent" placeholder="请输入User-Agent" />
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" :disabled="isLoading">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleSubmit" 
          :loading="isLoading"
        >
          {{ isLoading ? '处理中...' : '添加文件' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, defineProps, defineEmits, watch } from 'vue';
import { 
  ElDialog, ElForm, ElFormItem, ElInput, ElButton, 
  ElMessage, ElProgress 
} from 'element-plus';
import { useDatasetStore } from '@/stores/datasetStore';
import { useUploadStore } from '@/stores/uploadStore'; // Import upload store
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import * as apiService from '@/services/apiService';

const props = defineProps({
  visible: Boolean,
  datasetId: { type: String, required: true },
  datasetName: { type: String, default: '' },
  basePathInDataset: { type: String, default: '' },
});
const emit = defineEmits(['update:visible', 'file-added']);

const datasetStore = useDatasetStore();
const uploadStore = useUploadStore(); // Initialize upload store
const formRef = ref(null);
const isLoading = ref(false);
const loadingMessage = ref('');
// const fetchProgress = ref(0); // Will be driven by uploadStore now
const currentTaskId = ref(null); // To keep track of the current task

const form = reactive({
  url: '',
  fileName: '',
  referer: '',
  userAgent: '',
});

const rules = reactive({
  url: [
    { required: true, message: '请输入有效的URL', trigger: 'blur', type: 'url' },
  ],
  fileName: [
    { required: true, message: '请输入文件名', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value && value.includes('/')) {
          callback(new Error('文件名不能包含路径分隔符 (/)'));
        } else if (datasetStore.datasetConstraints?.file?.maxFileNameLength && value.length > datasetStore.datasetConstraints.file.maxFileNameLength) {
          callback(new Error(`文件名长度不能超过 ${datasetStore.datasetConstraints.file.maxFileNameLength} 字符`));
        }
        else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
});

watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetForm();
  }
});

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields();
  }
  form.url = '';
  form.fileName = '';
  form.referer = '';
  form.userAgent = '';
  isLoading.value = false;
  loadingMessage.value = '';
  // fetchProgress.value = 0;
  currentTaskId.value = null;
};

const attemptAutoFillFileName = () => {
  if (form.url) {
    try {
      const urlPath = new URL(form.url).pathname;
      const segments = urlPath.split('/');
      const lastSegment = segments.pop();
      if (lastSegment) {
        form.fileName = decodeURIComponent(lastSegment.split('?')[0]);
      }
    } catch (e) {
      console.warn("Could not auto-fill filename from URL:", e);
    }
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  formRef.value.validate(async (valid) => {
    if (valid) {
      isLoading.value = true;
      currentTaskId.value = uuidv4();
      loadingMessage.value = '准备抓取...';
      
      uploadStore.addTask({
        id: currentTaskId.value,
        name: form.fileName,
        type: 'file', // URL fetch is always a single file
        status: 'pending',
        progress: 0,
      });

      try {
        uploadStore.updateTaskStatus(currentTaskId.value, 'processing', 10, null); // Initial processing state
        loadingMessage.value = '正在抓取文件...';

        const payload = {
          url: form.url,
          fileName: form.fileName,
          referer: form.referer,
          userAgent: form.userAgent,
        };
        
        const fetchResult = await apiService.fetchUrlToDataset(payload);
        
        if (fetchResult.success && fetchResult.fileId) {
          uploadStore.updateTaskStatus(currentTaskId.value, 'processing', 50, null); // Fetch successful
          loadingMessage.value = '文件已抓取，正在添加到数据集...';

          let finalFileAbs = fetchResult.fileName || form.fileName; 
          if (props.basePathInDataset) {
            finalFileAbs = `${props.basePathInDataset.replace(/^\/+|\/+$/g, '')}/${finalFileAbs}`;
          }
          finalFileAbs = finalFileAbs.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

          const newFilesData = [{
            fileId: fetchResult.fileId,
            fileAbs: finalFileAbs,
            name: form.fileName, 
          }];

          const dataset = datasetStore.getDatasetById(props.datasetId);
          if (!dataset) {
            uploadStore.updateTaskStatus(currentTaskId.value, 'failed', 50, '目标数据集信息未找到');
            throw new Error('目标数据集信息未找到。');
          }
          const existingDatasetData = {
            datasetName: dataset.label || dataset.name,
            datasetAbs: dataset.description || dataset.abs,
            tags: dataset.tags || [],
            ispublic: dataset.ispublic !== undefined ? dataset.ispublic : 0,
            fileIds: dataset.fileIds || [],
            fileAbsList: dataset.fileAbsList || [],
          };

          await datasetStore.addFilesToDataset({
            datasetId: props.datasetId,
            newFilesData,
            existingDatasetData,
          });
          
          uploadStore.updateTaskStatus(currentTaskId.value, 'completed', 100);
          ElMessage.success(`文件 "${form.fileName}" 已成功添加到数据集 ${props.datasetName}。`);
          emit('file-added');
          emit('update:visible', false);

        } else {
          const errorMsg = fetchResult.message || fetchResult.error || '抓取文件失败';
          uploadStore.updateTaskStatus(currentTaskId.value, 'failed', 20, errorMsg); // Fetch failed
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error('通过URL添加文件失败:', error);
        ElMessage.error(`添加失败: ${error.message || '未知错误'}`);
        if (currentTaskId.value && !uploadStore.tasks.find(t=>t.id===currentTaskId.value)?.error) {
             uploadStore.updateTaskStatus(currentTaskId.value, 'failed', uploadStore.tasks.find(t=>t.id===currentTaskId.value)?.progress || 0, error.message || '未知处理错误');
        }
      } finally {
        isLoading.value = false;
        loadingMessage.value = '';
        // currentTaskId.value = null; // Keep task id for overlay to show final status
      }
    } else {
      ElMessage.error('请检查表单输入。');
      return false;
    }
  });
};

</script>

<style scoped>
.add-url-dialog .el-form-item {
  margin-bottom: 20px;
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
