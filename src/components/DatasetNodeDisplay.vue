<template>
  <div class="dataset-node-display-item" :class="`node-type-${node.type}`">
    <div class="node-content">
      <span class="node-label" @click="handleNodeClick" :title="node.path">
        <el-icon v-if="node.type === 'folder'" class="folder-icon">
          <FolderOpened v-if="isExpanded" />
          <Folder v-else />
        </el-icon>
        <span v-else-if="node.type === 'file'" class="file-icon-wrapper" :style="{ color: getFileIconColor(node.fileContentType, node.fileName || node.label) }">
          <svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align: middle;">
            <path fill="currentColor" :d="getFileIconPath(node.fileContentType, node.fileName || node.label)" />
          </svg>
        </span>
        <span class="node-text">{{ node.label }}</span>
      </span>
      <span class="node-actions">
        <el-tooltip v-if="node.type === 'file'" content="从数据集中移除此文件" placement="top">
          <el-button link type="danger" size="small" @click.stop="confirmRemoveFile" title="移除文件">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        <span v-if="node.type === 'file' && node.fileSize" class="file-size-info">
          {{ formatFileSize(node.fileSize) }}
        </span>
      </span>
    </div>
    <div v-if="node.type === 'folder' && node.children && node.children.length > 0 && isExpanded" class="node-children">
      <DatasetNodeDisplay
        v-for="childNode in node.children"
        :key="childNode.id"
        :node="childNode"
        :dataset-id="datasetId"
        :current-dataset-details="currentDatasetDetails"
        @file-click="$emit('file-click', $event)"
        @folder-click="$emit('folder-click', $event)"
        @remove-file="$emit('remove-file', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElIcon, ElButton, ElTooltip, ElMessageBox } from 'element-plus';
import { Folder, FolderOpened, Delete } from '@element-plus/icons-vue';
import { getFileIconPath, getFileIconColor, formatFileSize } from '@/utils/fileDisplayUtils';
import { useUIStore } from '@/stores/uiStore';

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  datasetId: { // Passed down for context, especially for actions on children
    type: [String, Number],
    required: true,
  },
  currentDatasetDetails: { // Pass the full dataset details for context if needed for actions
    type: Object,
    required: true,
  }
});

const emit = defineEmits(['file-click', 'folder-click', 'remove-file']);

const uiStore = useUIStore();
const isExpanded = ref(props.node.type === 'folder' ? true : false); // Default expand folders, or manage state

const handleNodeClick = () => {
  if (props.node.type === 'file') {
    // Emit an event or directly call uiStore.selectExplorerItem if this component is only used within MainContentDisplay
    // For now, let's assume MainContentDisplay will handle the selection.
    emit('file-click', { ...props.node, datasetId: props.datasetId });
     // Also update uiStore's selected item for global state consistency
    uiStore.selectExplorerItem({ ...props.node, datasetId: props.datasetId });
  } else if (props.node.type === 'folder') {
    isExpanded.value = !isExpanded.value;
    emit('folder-click', { ...props.node, datasetId: props.datasetId });
     // Update uiStore's selected item for global state consistency
    uiStore.selectExplorerItem({ ...props.node, datasetId: props.datasetId });
  }
};

const confirmRemoveFile = () => {
  if (props.node.type !== 'file') return;
  emit('remove-file', { fileNode: props.node, dataset: props.currentDatasetDetails });
};

// Expose utilities to template (alternative to importing them in <script setup> directly if preferred)
// const getFileIconPath = getFileIconPath;
// const getFileIconColor = getFileIconColor;
// const formatFileSize = formatFileSize;

</script>

<style scoped>
.dataset-node-display-item {
  padding: 2px 0px 2px 10px; /* Indent nested items */
  font-size: 14px;
  line-height: 24px;
}
.dataset-node-display-item.node-type-folder {
  /* Styles specific to folder items if needed */
}
.dataset-node-display-item.node-type-file {
  /* Styles specific to file items if needed */
}

.node-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: default; /* Default cursor, individual elements can override */
}
.node-content:hover {
  background-color: #383839; /* Similar to explorer panel hover */
}

.node-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer; /* Make label clickable */
  flex-grow: 1;
  overflow: hidden;
}
.node-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.folder-icon, .file-icon-wrapper {
  font-size: 16px;
  color: #85c1e9; /* Default folder color */
}
.file-icon-wrapper svg {
  width: 1em;
  height: 1em;
  font-size: 16px; /* Match icon size */
}
.node-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 10px; /* Space between label and actions */
}
.node-actions .el-button--small {
  padding: 2px 4px;
}
.node-actions .el-icon {
  font-size: 14px;
}
.file-size-info {
  font-size: 0.8em;
  color: #888888;
  white-space: nowrap;
}

.node-children {
  margin-left: 20px; /* Indent children further */
  border-left: 1px dashed #444; /* Visual guide for hierarchy */
}
</style>
