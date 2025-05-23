<template>
  <el-dialog
    :model-value="visible"
    :title="`向数据集添加服务器文件/文件夹: ${datasetName}`"
    width="60%"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="!isProcessingItems" 
    :close-on-press-escape="!isProcessingItems"
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
      <p>
        目标数据集: <strong>{{ targetDatasetDetails.label }}</strong>
        <span v-if="basePathInDataset">, 目标路径: <strong>{{ basePathInDataset }}</strong></span>
      </p>
      
      <h4>选择服务器上的文件或文件夹</h4>
      <div class="server-file-browser-in-dialog">
        <div class="path-selector">
          <el-select v-model="localSelectedBasePath" placeholder="选择基础路径" @change="handleLocalBasePathChange" size="small" :disabled="isProcessingItems">
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
              @click="!isProcessingItems && handleLocalNavigateToPath(index)"
              :class="{ 'breadcrumb-link': !isProcessingItems }"
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
          @selection-change="handleServerItemSelectionChange"
          ref="serverFilesTableRef"
          height="250px"
          size="small"
          class="files-table"
          :row-style="{ cursor: isProcessingItems ? 'not-allowed' : 'default' }"
        >
          <el-table-column type="selection" width="45" :selectable="isItemSelectable" :disabled="isProcessingItems" />
          <el-table-column prop="name" label="名称">
            <template #default="{ row }">
              <div class="file-name-in-dialog" @click="!isProcessingItems && handleLocalItemClick(row)" :class="{ 'disabled-click': isProcessingItems }">
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

      <div v-if="selectedServerItems.length > 0" class="selected-files-summary">
        <h4>已选待添加项目 ({{ selectedServerItems.length }}):</h4>
        <ul>
          <li v-for="item in selectedServerItems" :key="item.path">
            {{ item.name }} (类型: {{ item.type }}, 路径: {{ item.path }})
          </li>
        </ul>
      </div>

    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="$emit('update:visible', false)" :disabled="isProcessingItems">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleAddSelectedItems" 
          :loading="isProcessingItems || isLoadingInitialData"
          :disabled="selectedServerItems.length === 0"
        >
          {{ isProcessingItems ? `处理中... (${itemsProcessedCount}/${totalItemsToProcess})` : '添加已选项目' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { 
  ElDialog, ElSelect, ElOption, ElBreadcrumb, ElBreadcrumbItem, 
  ElTable, ElTableColumn, ElIcon, ElEmpty, ElSkeleton, 
  ElButton, ElMessage 
} from 'element-plus';
import { Folder, Document } from '@element-plus/icons-vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useUploadStore } from '@/stores/uploadStore'; // Import upload store
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { getServerFiles as apiGetServerFiles, registerServerFile as apiRegisterServerFile } from '@/services/apiService';

const props = defineProps({
  visible: Boolean,
  datasetId: {
    type: String,
    required: true
  },
  datasetName: { 
    type: String,
    default: ''
  },
  basePathInDataset: { 
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:visible', 'items-added']); 

const datasetStore = useDatasetStore();
const uploadStore = useUploadStore(); // Initialize upload store

const localCurrentPath = ref('.');
const localServerFiles = ref([]);
const localLoadingFiles = ref(false);
const localBasePaths = [ 
  { label: '项目根目录', value: '.' },
  { label: '上传目录', value: 'uploads' },
];
const localSelectedBasePath = ref('.');
const selectedServerItems = ref([]); 
const serverFilesTableRef = ref(null);
const isProcessingItems = ref(false);
const isLoadingInitialData = ref(false);
const targetDatasetDetails = ref(null);

const itemsProcessedCount = ref(0);
const totalItemsToProcess = ref(0);

const localPathSegments = computed(() => {
  if (typeof localCurrentPath.value !== 'string') return [localSelectedBasePath.value];
  const segments = localCurrentPath.value.split('/');
  if (segments.length === 0 || (segments.length === 1 && segments[0] === '')) {
      const basePath = localBasePaths.find(bp => bp.value === localSelectedBasePath.value);
      return [basePath ? basePath.label : localSelectedBasePath.value];
  }
  // Special handling for root alias like "uploads"
  if (segments.length === 1 && localBasePaths.some(bp => bp.value === segments[0])) {
     const basePathLabel = localBasePaths.find(bp => bp.value === segments[0])?.label;
     return basePathLabel ? [basePathLabel] : [segments[0]]; // Return just the alias label
  }
  // For deeper paths, show the alias as root then subsequent parts
  const rootAlias = localBasePaths.find(bp => bp.value === localSelectedBasePath.value)?.label || localSelectedBasePath.value;
  const pathRelativeToBase = localCurrentPath.value.startsWith(localSelectedBasePath.value + '/') 
      ? localCurrentPath.value.substring(localSelectedBasePath.value.length + 1) 
      : localCurrentPath.value;

  if (!pathRelativeToBase || pathRelativeToBase === '.') return [rootAlias];
  
  return [rootAlias, ...pathRelativeToBase.split('/').filter(s => s)];
});


const fetchLocalServerFiles = async (path) => {
  localLoadingFiles.value = true;
  localServerFiles.value = [];
  try {
    const data = await apiGetServerFiles(path);
    localServerFiles.value = data.files.map(f => ({
        ...f,
        // Ensure path is correctly formed relative to the browsed structure
        path: data.currentPath === '.' ? f.name : ( data.currentPath.endsWith('/') ? `${data.currentPath}${f.name}` : `${data.currentPath}/${f.name}`)
    }));
    localCurrentPath.value = data.currentPath;
  } catch (error) {
    ElMessage.error(`(Dialog) 获取文件列表失败: ${error.message}`);
    localServerFiles.value = [];
  } finally {
    localLoadingFiles.value = false;
  }
};

const handleLocalItemClick = (item) => { 
  if (isProcessingItems.value) return;
  if (item.type === '文件夹') {
    fetchLocalServerFiles(item.path);
  }
};

const handleLocalNavigateToPath = (index) => {
  if (isProcessingItems.value) return;
  let newPath;
  const currentSegments = localCurrentPath.value.split('/');
  
  if (index === 0) { // Clicked on the root alias
    newPath = localSelectedBasePath.value;
  } else {
    // Reconstruct path based on actual segments, not label segments
    // Need to map label segments back to actual path segments if they differ significantly
    // For simplicity, assume segments in localPathSegments (excluding root alias) map to currentSegments after selectedBasePath
    const pathParts = localCurrentPath.value.startsWith(localSelectedBasePath.value + '/')
        ? localCurrentPath.value.substring(localSelectedBasePath.value.length + 1).split('/')
        : (localCurrentPath.value === localSelectedBasePath.value ? [] : localCurrentPath.value.split('/'));

    newPath = localSelectedBasePath.value;
    if (pathParts.length > 0 && index > 0) { // index 0 is root alias
        newPath += '/' + pathParts.slice(0, index -1).join('/'); // index-1 because segment array for pathParts doesn't include root alias
    }
  }
  fetchLocalServerFiles(newPath);
};


const handleLocalBasePathChange = (newBasePath) => {
  if (isProcessingItems.value) return;
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

const isItemSelectable = () => !isProcessingItems.value; // Allow selecting both files and folders

const handleServerItemSelectionChange = (selection) => {
  if (isProcessingItems.value) return;
  selectedServerItems.value = selection;
};

const onDialogOpen = async () => {
  isLoadingInitialData.value = true;
  targetDatasetDetails.value = null;
  if (props.datasetId) {
    let details = datasetStore.getDatasetById(props.datasetId);
    if (!details || !details.fileIds) { 
        details = await datasetStore.fetchDatasetDetails(props.datasetId, true);
    }
    targetDatasetDetails.value = details;

    localCurrentPath.value = '.'; 
    localSelectedBasePath.value = '.';
    selectedServerItems.value = [];
    itemsProcessedCount.value = 0;
    totalItemsToProcess.value = 0;
    if (serverFilesTableRef.value) serverFilesTableRef.value.clearSelection();
    await fetchLocalServerFiles(localSelectedBasePath.value);
  } else {
      ElMessage.error("未提供目标数据集ID。");
  }
  isLoadingInitialData.value = false;
};

watch(() => props.visible, (newVisible) => {
  if (newVisible && props.datasetId) {
    onDialogOpen();
  }
}, { immediate: true });


const handleAddSelectedItems = async () => {
  if (!targetDatasetDetails.value || selectedServerItems.value.length === 0) {
    ElMessage.info("没有选择项目或目标数据集无效。");
    return;
  }
  isProcessingItems.value = true;
  itemsProcessedCount.value = 0;
  totalItemsToProcess.value = selectedServerItems.value.length;

  const allResults = []; 
  let overallSuccess = true;

  const batchTaskId = uuidv4();
  const taskName = `添加服务器项目到 ${props.datasetName || targetDatasetDetails.value.label}`;
  const taskType = selectedServerItems.value.length > 1 || selectedServerItems.value.some(item => item.type === '文件夹') ? 'folder' : 'file';
  
  uploadStore.addTask({
    id: batchTaskId,
    name: taskName,
    type: taskType,
    status: 'processing', // Server registration is more like processing
    progress: 0,
    itemCount: totalItemsToProcess.value,
  });

  try {
    for (const item of selectedServerItems.value) {
      const payload = { 
        filePath: item.path, 
        fileName: item.name, 
        folderPath: props.basePathInDataset,
      };
      
      uploadStore.updateTaskStatus(batchTaskId, 'processing', Math.round((itemsProcessedCount.value / totalItemsToProcess.value) * 50));

      const resultsFromServer = await apiRegisterServerFile(payload); 

      if (Array.isArray(resultsFromServer)) { 
        resultsFromServer.forEach(res => {
          if (res.success && res.fileId) {
            allResults.push({ fileId: res.fileId, fileAbs: res.fileAbs, name: res.fileName });
          } else {
            // ElMessage.error(`处理文件夹 "${item.name}" 内文件 "${res.fileName}" 失败: ${res.error || '未知错误'}`);
            overallSuccess = false;
          }
        });
      } else if (resultsFromServer.success && resultsFromServer.fileId) { 
        allResults.push({ fileId: resultsFromServer.fileId, fileAbs: resultsFromServer.fileAbs, name: resultsFromServer.fileName });
      } else {
        // ElMessage.error(`处理项目 "${item.name}" 失败: ${resultsFromServer.error || '未知错误'}`);
        overallSuccess = false;
      }
      itemsProcessedCount.value++;
      uploadStore.updateTaskStatus(batchTaskId, 'processing', Math.round((itemsProcessedCount.value / totalItemsToProcess.value) * 50));
    }

    if (allResults.length > 0) {
      uploadStore.updateTaskStatus(batchTaskId, 'processing', 75); // Mark as further processing
      const existingDatasetData = {
          datasetName: targetDatasetDetails.value.label,
          datasetAbs: targetDatasetDetails.value.description,
          tags: targetDatasetDetails.value.tags,
          ispublic: targetDatasetDetails.value.ispublic !== undefined ? targetDatasetDetails.value.ispublic : 0,
          fileIds: targetDatasetDetails.value.fileIds || [],
          fileAbsList: targetDatasetDetails.value.fileAbsList || [],
      };
      
      await datasetStore.addFilesToDataset({
          datasetId: props.datasetId,
          newFilesData: allResults, 
          existingDatasetData
      });
      // ElMessage.success(`成功向数据集 "${props.datasetName || targetDatasetDetails.value.label}" 添加 ${allResults.length} 个文件条目。`);
      // emit('items-added'); 
      // emit('update:visible', false); // Dialog will be closed via overlay interaction or if preferred
    } else if (selectedServerItems.value.length > 0 && !overallSuccess) {
        // ElMessage.warning("未能成功处理任何选定项目。"); // Store will show error
    }

    if (overallSuccess && allResults.length === selectedServerItems.value.reduce((acc,item) => acc + (item.type === '文件夹' ? ( (apiRegisterServerFile(payload)).length || 1) : 1) ,0) ) { // Approximation
        uploadStore.updateTaskStatus(batchTaskId, 'completed', 100);
         ElMessage.success(`所有项目已成功添加到数据集 ${props.datasetName || targetDatasetDetails.value.label}。`);
    } else if (allResults.length > 0) { // Partial success
        const errorMsg = `部分项目添加失败。成功: ${allResults.length} 个文件条目。`;
        uploadStore.updateTaskStatus(batchTaskId, 'failed', 100, errorMsg); // Mark as failed but 100% processed
        ElMessage.warning(errorMsg);
    } else { // Complete failure or no files resulted
        uploadStore.updateTaskStatus(batchTaskId, 'failed', itemsProcessedCount.value > 0 ? 100 : 0, "未能处理任何项目。");
        ElMessage.error("未能处理任何项目。");
    }


  } catch (error) {
    console.error('添加项目到数据集失败:', error);
    // ElMessage.error(`操作失败: ${error.message}`);
    uploadStore.updateTaskStatus(batchTaskId, 'failed', uploadStore.tasks.find(t=>t.id===batchTaskId)?.progress || 50, error.message || "未知处理错误");
  } finally {
    isProcessingItems.value = false;
     if (overallSuccess && allResults.length > 0) {
        emit('items-added'); 
        emit('update:visible', false);
    }
  }
};

</script>

<style scoped>
.add-files-dialog .el-dialog__body { padding-top: 10px; padding-bottom: 10px; }
.loading-dataset-placeholder, .dialog-error-placeholder { text-align: center; padding: 20px; color: #909399; }
.server-file-browser-in-dialog { border: 1px solid #e0e0e0; padding: 10px; border-radius: 4px; margin-top: 10px; }
.path-selector { margin-bottom: 8px; }
.path-navigation { margin-bottom: 8px; padding: 6px; background: #f5f7fa; border-radius: 3px; font-size: 12px; }
.path-navigation .el-breadcrumb__item .breadcrumb-link :deep(.el-breadcrumb__inner) {
  cursor: pointer !important;
}
.files-table { font-size: 12px; }
.file-name-in-dialog { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.file-name-in-dialog:not(.disabled-click):hover span { color: #409EFF; }
.file-name-in-dialog.disabled-click { cursor: not-allowed; opacity: 0.7; }
.empty-state-dialog { margin-top: 10px; }
.selected-files-summary { margin-top: 15px; padding: 10px; background-color: #f9f9f9; border-radius: 4px; }
.selected-files-summary h4 { margin-top: 0; margin-bottom: 8px; font-size: 14px; }
.selected-files-summary ul { list-style-type: none; padding-left: 0; font-size: 13px; max-height: 100px; overflow-y: auto; }
.selected-files-summary li { padding: 2px 0; }
.dialog-footer { display: flex; justify-content: flex-end; }
</style>
