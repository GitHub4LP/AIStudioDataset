<template>
  <el-dialog
    :model-value="visible"
    title="向数据集添加文件"
    width="60%"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @open="onDialogOpen"
    class="add-files-dialog"
  >
    <div v-if="isLoadingInitialData" class="loading-dataset-placeholder">
        <el-skeleton :rows="2" animated />
        正在加载数据集信息...
    </div>
    <div v-else-if="!targetDatasetDetails" class="dialog-error-placeholder">
        无法加载目标数据集信息。
    </div>
    <div v-else>
      <p>正在向数据集: <strong>{{ targetDatasetDetails.label }}</strong> 添加文件。</p>
      
      <h4>选择服务器文件</h4>
      <div class="server-file-browser-in-dialog">
        <div class="path-selector">
          <el-select v-model="localSelectedBasePath" placeholder="选择基础路径" @change="handleLocalBasePathChange" size="small">
            <el-option
              v-for="pathItem in localBasePaths"
              :key="pathItem.value"
              :label="pathItem.label"
              :value="pathItem.value"
            />
          </el-select>
        </div>
        <div class="path-navigation">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item
              v-for="(item, index) in localPathSegments"
              :key="index"
              @click="handleLocalNavigateToPath(index)"
            >
              {{ item }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div v-if="localLoadingFiles" class="loading-state">
          <el-skeleton :rows="3" animated />
        </div>
        <el-table
          v-else
          :data="localServerFiles"
          @selection-change="handleServerFileSelectionChange"
          ref="serverFilesTableRef"
          height="250px"
          size="small"
          class="files-table"
        >
          <el-table-column type="selection" width="45" :selectable="isSelectable" />
          <el-table-column prop="name" label="文件名">
            <template #default="{ row }">
              <div class="file-name-in-dialog" @click="handleLocalFileClick(row)">
                <el-icon v-if="row.type === '文件夹'"><Folder /></el-icon>
                <el-icon v-else><Document /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="size" label="大小" width="100">
            <template #default="{ row }">
              {{ row.type === '文件夹' ? '-' : formatFileSize(row.size) }}
            </template>
          </el-table-column>
        </el-table>
        <div v-if="!localLoadingFiles && localServerFiles.length === 0" class="empty-state-dialog">
          <el-empty description="当前目录为空" :image-size="50" />
        </div>
      </div>

      <div v-if="newlySelectedServerFilesForUpload.length > 0" class="selected-files-summary">
        <h4>已选待添加文件:</h4>
        <ul>
          <li v-for="file in newlySelectedServerFilesForUpload" :key="file.path">
            {{ file.name }} (路径: {{ file.path }})
          </li>
        </ul>
      </div>

    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" :disabled="isProcessingFiles">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleAddSelectedFiles" 
          :loading="isProcessingFiles || isLoadingInitialData"
          :disabled="newlySelectedServerFilesForUpload.length === 0"
        >
          {{ isProcessingFiles ? '处理中...' : '添加已选文件' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, defineProps, defineEmits } from 'vue';
import { 
  ElDialog, ElSelect, ElOption, ElBreadcrumb, ElBreadcrumbItem, 
  ElTable, ElTableColumn, ElIcon, ElEmpty, ElSkeleton, 
  ElButton, ElMessage 
} from 'element-plus';
import { Folder, Document } from '@element-plus/icons-vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { getServerFiles as apiGetServerFiles, registerServerFile as apiRegisterServerFile } from '@/services/apiService';

const props = defineProps({
  visible: Boolean,
  datasetId: { // Changed from 'dataset' object
    type: String,
    default: null
  }
});

const emit = defineEmits(['update:visible']); // Removed 'files-added'

const datasetStore = useDatasetStore();

// Local state for this dialog's file browser
const localCurrentPath = ref('.');
const localServerFiles = ref([]);
const localLoadingFiles = ref(false);
const localBasePaths = [ /* Static for now, could be from a store/config */
  { label: '项目根目录', value: '.' },
  { label: '上传目录', value: 'uploads' },
  { label: '下载目录', value: 'downloads' }
];
const localSelectedBasePath = ref('.');
const newlySelectedServerFilesForUpload = ref([]); // Files selected in this dialog's table
const serverFilesTableRef = ref(null);
const isProcessingFiles = ref(false);
const isLoadingInitialData = ref(false); // For loading target dataset details
const targetDatasetDetails = ref(null); // Store fetched dataset details

const localPathSegments = computed(() => {
  if (typeof localCurrentPath.value !== 'string') return [localSelectedBasePath.value];
  const segments = localCurrentPath.value.split('/');
  if (segments.length === 0 || (segments.length === 1 && segments[0] === '')) {
      const basePath = localBasePaths.find(bp => bp.value === localSelectedBasePath.value);
      return [basePath ? basePath.label : localSelectedBasePath.value];
  }
  if (segments.length === 1 && localBasePaths.some(bp => bp.value === segments[0])) {
     const basePathLabel = localBasePaths.find(bp => bp.value === segments[0])?.label;
     return basePathLabel ? [basePathLabel] : [segments[0]];
  }
  return segments.map(segment => {
      if (segment === '.') {
          const basePath = localBasePaths.find(bp => bp.value === localSelectedBasePath.value);
          return basePath ? basePath.label : '根目录';
      }
      return segment;
  });
});

const fetchLocalServerFiles = async (path) => {
  localLoadingFiles.value = true;
  localServerFiles.value = [];
  try {
    const data = await apiGetServerFiles(path); // Use apiService
    localServerFiles.value = data.files.map(f => ({
        ...f,
        path: data.currentPath === '.' ? f.name : `${data.currentPath}/${f.name}`
    }));
    localCurrentPath.value = data.currentPath;
  } catch (error) {
    ElMessage.error(`(Dialog) 获取文件列表失败: ${error.message}`);
    localServerFiles.value = [];
  } finally {
    localLoadingFiles.value = false;
  }
};

const handleLocalFileClick = (file) => {
  if (file.type === '文件夹') {
    fetchLocalServerFiles(file.path);
  }
};

const handleLocalNavigateToPath = (index) => {
  let newPath;
  if (index === 0) newPath = localSelectedBasePath.value;
  else {
    const pathParts = localCurrentPath.value.split('/').slice(0, index + 1);
    newPath = pathParts.join('/');
  }
  fetchLocalServerFiles(newPath);
};

const handleLocalBasePathChange = (newBasePath) => {
  localSelectedBasePath.value = newBasePath;
  fetchLocalServerFiles(newBasePath);
};

const formatFileSize = (size) => {
  if (size === undefined || size === null) return '-';
  if (size === 0) return '0 B';
  const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const isSelectable = (row) => row.type === '文件';

const handleServerFileSelectionChange = (selection) => {
  newlySelectedServerFilesForUpload.value = selection;
};

const onDialogOpen = async () => {
  isLoadingInitialData.value = true;
  targetDatasetDetails.value = null;
  if (props.datasetId) {
    let details = datasetStore.getDatasetById(props.datasetId);
    if (!details || !details.fileIds) { // Check if we have full details including fileIds
        // console.log(`AddFilesDialog: Fetching details for ${props.datasetId}`);
        details = await datasetStore.fetchDatasetDetails(props.datasetId, true);
    }
    targetDatasetDetails.value = details;

    localCurrentPath.value = '.'; // Reset browser state
    localSelectedBasePath.value = '.';
    newlySelectedServerFilesForUpload.value = [];
    if (serverFilesTableRef.value) serverFilesTableRef.value.clearSelection();
    await fetchLocalServerFiles(localSelectedBasePath.value);
  } else {
      ElMessage.error("未提供目标数据集ID。");
  }
  isLoadingInitialData.value = false;
};

watch(() => [props.visible, props.datasetId], ([newVisible, newId]) => {
  if (newVisible && newId) {
    onDialogOpen();
  }
}, { immediate: true });

const handleAddSelectedFiles = async () => {
  if (!targetDatasetDetails.value || newlySelectedServerFilesForUpload.value.length === 0) {
    ElMessage.info("没有选择文件或目标数据集无效。");
    return;
  }
  isProcessingFiles.value = true;
  const newFilesData = []; // To store { fileId, fileAbs }

  try {
    for (const file of newlySelectedServerFilesForUpload.value) {
      const uploadPayload = { filePath: file.path, fileName: file.name };
      // console.log("Registering server file:", uploadPayload);
      const result = await apiRegisterServerFile(uploadPayload); // Use apiService
      newFilesData.push({ fileId: result.fileId, fileAbs: result.fileAbs });
    }

    // Prepare data for the store action
    const existingDatasetData = {
        datasetName: targetDatasetDetails.value.label,
        datasetAbs: targetDatasetDetails.value.description,
        tags: targetDatasetDetails.value.tags,
        ispublic: targetDatasetDetails.value.ispublic,
        fileIds: targetDatasetDetails.value.fileIds || [], // Ensure these are arrays
        fileAbsList: targetDatasetDetails.value.fileAbsList || [],
    };
    
    await datasetStore.addFilesToDataset({
        datasetId: props.datasetId,
        newFilesData,
        existingDatasetData
    });

    ElMessage.success(`成功向数据集 "${targetDatasetDetails.value.label}" 添加 ${newFilesData.length} 个文件。`);
    emit('update:visible', false);
    // No 'files-added' emit needed; store reactivity handles UI updates.
  } catch (error) {
    console.error('添加文件到数据集失败:', error);
    ElMessage.error(`操作失败: ${error.message}`);
  } finally {
    isProcessingFiles.value = false;
  }
};

</script>

<style scoped>
.add-files-dialog .el-dialog__body { padding-top: 10px; padding-bottom: 10px; }
.loading-dataset-placeholder, .dialog-error-placeholder { text-align: center; padding: 20px; color: #909399; }
.server-file-browser-in-dialog { border: 1px solid #e0e0e0; padding: 10px; border-radius: 4px; margin-top: 10px; }
.path-selector { margin-bottom: 8px; }
.path-navigation { margin-bottom: 8px; padding: 6px; background: #f5f7fa; border-radius: 3px; font-size: 12px; }
.files-table { font-size: 12px; }
.file-name-in-dialog { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.file-name-in-dialog:hover span { color: #409EFF; }
.empty-state-dialog { margin-top: 10px; }
.selected-files-summary { margin-top: 15px; padding: 10px; background-color: #f9f9f9; border-radius: 4px; }
.selected-files-summary h4 { margin-top: 0; margin-bottom: 8px; font-size: 14px; }
.selected-files-summary ul { list-style-type: none; padding-left: 0; font-size: 13px; max-height: 100px; overflow-y: auto; }
.selected-files-summary li { padding: 2px 0; }

/* Dark theme adaptations if needed later */
.add-files-dialog.dark-theme .server-file-browser-in-dialog { /* border-color: #333; */ }
</style>
