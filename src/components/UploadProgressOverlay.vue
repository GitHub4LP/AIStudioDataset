<template>
  <div v-if="uiStore.isUploadProgressVisible" class="upload-progress-overlay">
    <el-card class="box-card" :class="{ 'is-minimized': isMinimized }">
      <template #header>
        <div class="clearfix">
          <span>{{ t('upload.tasks', { count: uploadStore.activeTasks.length }) }}</span>
          <div class="header-buttons">
            <el-button link @click="toggleMinimize" class="header-button" :title="isMinimized ? t('upload.maximize') : t('upload.minimize')">
              <el-icon><Minus v-if="!isMinimized" /><Plus v-if="isMinimized" /></el-icon>
            </el-button>
            <el-tooltip :content="t('upload.clearCompletedTip')" placement="top">
              <el-button link @click="uploadStore.clearCompleted()" class="header-button" :disabled="uploadStore.completedTasks.length === 0">
                <el-icon><CircleCloseFilled /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip :content="t('upload.closeOverlayTip')" placement="top">
              <el-button link type="danger" @click="uiStore.setUploadProgressVisibility(false)" class="header-button">
                <el-icon><CloseBold /></el-icon>
              </el-button>
            </el-tooltip>
            <!-- Removed the original close all tasks button, replaced by close overlay -->
            <!-- <el-tooltip :content="t('upload.closeAllTip')" placement="top">
                 <el-button link type="danger" @click="confirmCloseAllTasks" class="header-button" :disabled="uploadStore.tasks.length === 0">
                    <el-icon><CloseBold /></el-icon>
                </el-button>
            </el-tooltip> -->
          </div>
        </div>
      </template>
      <div v-show="!isMinimized" class="task-list">
        <div v-if="uploadStore.tasks.length === 0" class="no-tasks">
          <p>{{ t('upload.noTasks') }}</p>
        </div>
        <div v-for="task in uploadStore.allTasksSorted" :key="task.id" class="task-item" :class="`task-status-${task.status}`">
          <div class="task-info">
            <span class="task-name" :title="task.name">
              <el-icon v-if="task.type === 'folder'" class="task-type-icon"><Folder /></el-icon>
              <el-icon v-else class="task-type-icon"><Document /></el-icon>
              {{ task.name }}
            </span>
            <span class="task-status">{{ getStatusText(task.status) }}</span>
          </div>
          <div class="task-details">
            <div>{{ t('upload.target') }}: {{ task.targetDatasetName || task.targetDatasetId || t('common.unknown') }}</div>
            <div v-if="task.status === 'completed' && task.fileId" class="task-file-id">File ID: {{ task.fileId }}</div>
          </div>
          <el-progress 
            :percentage="task.progress" 
            :status="getProgressStatus(task.status)" 
            :stroke-width="10" 
            :indeterminate="task.uploadType === 'url-fetch' && (task.status === 'uploading' || task.status === 'processing')"
            :show-text="!(task.uploadType === 'url-fetch' && (task.status === 'uploading' || task.status === 'processing'))"
            class="task-progress-bar" 
          />
          <div v-if="task.error" class="task-error">
            <el-icon><WarningFilled /></el-icon> {{ task.error }}
          </div>
          
          <div v-if="task.type === 'folder' && task.subTasks && task.subTasks.length > 0" class="sub-tasks">
            <el-button link @click="toggleSubTaskVisibility(task.id)" size="small" class="toggle-subtasks-btn">
              {{ visibleSubTasks[task.id] ? t('upload.hideSubtasks') : t('upload.showSubtasks') }} ({{ task.subTasks.length }})
            </el-button>
            <div v-if="visibleSubTasks[task.id]">
              <div v-for="subTask in task.subTasks" :key="subTask.id" class="sub-task-item">
                <div class="task-info">
                  <span class="task-name subtask-name" :title="subTask.name">
                    <el-icon class="task-type-icon"><Document /></el-icon>
                    {{ subTask.name }}
                  </span>
                  <span class="task-status subtask-status">{{ getStatusText(subTask.status) }}</span>
                </div>
                <div v-if="subTask.status === 'completed' && subTask.fileId" class="task-file-id subtask-file-id">File ID: {{ subTask.fileId }}</div>
                <el-progress :percentage="subTask.progress" :status="getProgressStatus(subTask.status)" :stroke-width="6" class="task-progress-bar" />
                 <div v-if="subTask.error" class="task-error subtask-error">
                    <el-icon><WarningFilled /></el-icon> {{ subTask.error }}
                </div>
              </div>
            </div>
          </div>
          <el-button link @click="uploadStore.removeTask(task.id)" class="remove-task-btn" :title="t('upload.removeTask')">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'; // Added watch
import { useUploadStore } from '@/stores/uploadStore';
import { useUIStore } from '@/stores/uiStore'; // Import uiStore
import { ElCard, ElButton, ElProgress, ElIcon, ElTooltip, ElMessageBox, ElMessage } from 'element-plus'; // Added ElMessage
import { Folder, Document, Minus, Plus, Close, CircleCloseFilled, CloseBold, WarningFilled } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const uploadStore = useUploadStore();
const uiStore = useUIStore(); // Initialize uiStore
const isMinimized = ref(false);
const visibleSubTasks = reactive({}); // Tracks visibility of sub-tasks for each folder task

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value;
};

const toggleSubTaskVisibility = (taskId) => {
  visibleSubTasks[taskId] = !visibleSubTasks[taskId];
};

const getStatusText = (status) => {
  const map = {
    pending: t('upload.status.pending'),
    uploading: t('upload.status.uploading'),
    processing: t('upload.status.processing'),
    completed: t('upload.status.completed'),
    failed: t('upload.status.failed'),
  };
  return map[status] || status;
};

const getProgressStatus = (status) => {
  if (status === 'failed') return 'exception';
  if (status === 'completed') return 'success';
  return undefined; // Default progress bar color
};

// The confirmCloseAllTasks is not directly used in the template anymore,
// but if it's intended to be kept for other purposes or future use, it's fine.
// Otherwise, it could be removed if the "close overlay" button is the permanent replacement.
// For now, I'll keep it as it might be part of "Verify Existing Functionality"
const confirmCloseAllTasks = () => {
    ElMessageBox.confirm(
        t('upload.closeAllConfirm'),
        t('upload.closeAllTitle'),
        {
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel'),
            type: 'warning',
        }
    ).then(() => {
        uploadStore.clearAllTasks(); 
        ElMessage.info(t('upload.allTasksClosed'));
    }).catch(() => {
        // User cancelled
    });
};

watch(() => uploadStore.allTasksSorted, (newTasks) => {
  if (newTasks) {
    newTasks.forEach(task => {
      if (task.type === 'folder' && task.subTasks && task.subTasks.length > 0) {
        console.debug(`UploadProgressOverlay: Folder Task '${task.name}' (ID: ${task.id}) is about to render with subTasks:`, JSON.parse(JSON.stringify(task.subTasks)));
      } else if (task.type === 'folder' && (!task.subTasks || task.subTasks.length === 0)) {
        console.debug(`UploadProgressOverlay: Folder Task '${task.name}' (ID: ${task.id}) has no subTasks or subTasks array is empty.`);
      }
    });
  }
}, { deep: true, immediate: true });

</script>

<style scoped>
.upload-progress-overlay {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px; /* Default width */
  max-width: 90vw; /* Ensure it doesn't overflow viewport horizontally */
  z-index: 2050; /* Ensure it's above most other elements, but less than ElMessage */
}

@media (max-width: 480px) { /* Adjust for smaller screens */
  .upload-progress-overlay {
    width: 95vw; /* Take up more width on small screens */
    right: 2.5vw;
    bottom: 10px;
  }
}

.box-card {
  background-color: #2c2c2d;
  color: #e0e0e0;
  border: 1px solid #444;
}
.box-card :deep(.el-card__header) {
  background-color: #333333;
  color: #e0e0e0;
  border-bottom: 1px solid #444;
  padding: 10px 15px;
}
.box-card :deep(.el-card__body) {
  padding: 0;
  max-height: 400px; /* Max height before scroll */
  overflow-y: auto;
}
.box-card.is-minimized :deep(.el-card__body) {
  display: none;
}
.clearfix {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-buttons .el-button {
  padding: 5px;
  color: #c0c4cc;
}
.header-buttons .el-button:hover {
  color: #ffffff;
}
.header-buttons .el-button.el-button--danger:hover {
    color: #f89898;
}

.task-list {
  padding: 10px;
}
.no-tasks {
  text-align: center;
  padding: 20px;
  color: #909399;
}
.task-item {
  padding: 8px 0;
  border-bottom: 1px solid #444;
  position: relative;
}
.task-item:last-child {
  border-bottom: none;
}
.task-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  font-size: 13px;
}
.task-details {
  font-size: 0.8em;
  color: #b0b0b0;
  margin-bottom: 4px;
}
.task-file-id {
  font-size: 0.9em; /* Slightly smaller than main details */
  color: #a0a0a0;
  margin-top: 2px;
}
.subtask-file-id {
  font-size: 0.85em;
  margin-left: 20px; /* Align with subtask name indent */
  margin-bottom: 2px;
}
.task-name {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-grow: 1;
  margin-right: 10px;
}
.task-type-icon {
  font-size: 14px;
  color: #85c1e9; /* Default icon color */
}
.task-status {
  font-size: 0.85em;
  color: #a0a0a0;
  white-space: nowrap;
}
.task-status-completed .task-status { color: #67c23a; }
.task-status-failed .task-status { color: #f56c6c; }
.task-status-uploading .task-status { color: #e6a23c; }


.task-progress-bar {
  margin-bottom: 5px;
}
.task-error {
  font-size: 0.8em;
  color: #f56c6c;
  margin-top: 3px;
  display: flex;
  align-items: center;
}
.task-error .el-icon {
    margin-right: 4px;
}

.remove-task-btn {
  position: absolute;
  top: 5px;
  right: 0px;
  padding: 2px;
  color: #909399;
}
.remove-task-btn:hover {
  color: #f56c6c;
}
.remove-task-btn .el-icon {
    font-size: 12px;
}

.sub-tasks {
  margin-left: 10px;
  margin-top: 8px;
  padding-left: 10px;
  border-left: 2px solid #4a4a4a;
}
.toggle-subtasks-btn {
  font-size: 12px;
  padding: 2px 0;
  color: #79bbff;
}
.sub-task-item {
  padding: 4px 0;
  margin-top: 4px;
}
.subtask-name {
  font-size: 0.9em;
  color: #c0c0c0;
}
.subtask-status {
  font-size: 0.8em;
}
.subtask-error {
    font-size: 0.75em;
}
</style>
