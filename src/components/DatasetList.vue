<template>
  <div class="dataset-list">
    <h2>我的数据集</h2>
    <div v-if="loading">
      <div class="loading-progress">
        <div class="progress-text">加载中... {{ loadedPages }}/{{ totalPages }} 页</div>
        <div class="progress-bar">
          <div class="progress-inner" :style="{ width: `${(loadedPages / totalPages) * 100}%` }"></div>
        </div>
      </div>
    </div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else>
      <el-tree
        :data="treeData"
        :props="treeProps"
        node-key="id"
        highlight-current
        class="dataset-tree"
      >
        <template #default="{ node, data }">
          <span v-if="data.isFile">
            <span class="file-icon" :style="{ color: getFileIcon(data.file.fileContentType, data.file.fileName).color }">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" :d="getFileIcon(data.file.fileContentType, data.file.fileName).icon"/>
              </svg>
            </span>
            <span class="file-name">{{ data.label }}</span>
            <span class="file-type">{{ data.file.fileContentType }}</span>
            <a class="download-link" href="#" @click.prevent="handleDownload(data.file, data.datasetId)">下载</a>
            <span class="file-id">ID: {{ data.file.fileId }}</span>
                      </span>
          <span v-else>
            <span class="folder-tree-icon">📁</span>
            <span class="folder-name">{{ data.label }}</span>
                          </span>
        </template>
      </el-tree>
    </div>
  </div>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus'
import { ref } from 'vue'

const PAGE_SIZE = 20
const MAX_CONCURRENT_REQUESTS = 3

// 文件类型图标映射
const FILE_TYPE_ICONS = {
  'image/': {
    icon: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
    color: '#4CAF50'
  },
  'text/': {
    icon: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z',
    color: '#2196F3'
  },
  'application/javascript': {
    icon: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
    color: '#FFC107'
  },
  'audio/': {
    icon: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
    color: '#9C27B0'
  },
  'video/': {
    icon: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
    color: '#E91E63'
  },
  'application/pdf': {
    icon: 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z',
    color: '#F44336'
  },
  'application/msword': {
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z',
    color: '#2196F3'
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z',
    color: '#2196F3'
  },
  'application/vnd.ms-excel': {
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z',
    color: '#4CAF50'
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z',
    color: '#4CAF50'
  },
  'application/vnd.ms-powerpoint': {
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z',
    color: '#FF9800'
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z',
    color: '#FF9800'
  },
  'application/zip': {
    icon: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z',
    color: '#795548'
  },
  'application/x-rar-compressed': {
    icon: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z',
    color: '#795548'
  },
  'application/x-7z-compressed': {
    icon: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z',
    color: '#795548'
  },
  'default': {
    icon: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z',
    color: '#9E9E9E'
  }
}

const EXTENSION_TO_MIME = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'bmp': 'image/bmp',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'm4a': 'audio/mp4',
  'flac': 'audio/flac',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'mkv': 'video/x-matroska',
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'zip': 'application/zip',
  'rar': 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
  'js': 'application/javascript',
  'html': 'text/html',
  'css': 'text/css',
  'json': 'application/json',
  'xml': 'application/xml',
  'txt': 'text/plain',
  'md': 'text/markdown',
  'py': 'text/x-python',
  'java': 'text/x-java-source',
  'c': 'text/x-csrc',
  'cpp': 'text/x-c++src',
  'cs': 'text/x-csharp',
  'php': 'text/x-php',
  'rb': 'text/x-ruby',
  'go': 'text/x-go',
  'rs': 'text/x-rust',
  'swift': 'text/x-swift',
  'kt': 'text/x-kotlin',
  'ts': 'application/typescript'
}

export default {
  name: 'DatasetList',
  data() {
    return {
      datasets: [],
      loading: true,
      error: null,
      totalPages: 0,
      loadedPages: 0,
      treeData: [],
      treeProps: { label: 'label', children: 'children' },
      downloadingFiles: new Set(),
    }
  },
  methods: {
    formatDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    formatFileSize(size) {
      if (!size) return '未知大小';
      const units = ['B', 'KB', 'MB', 'GB'];
      let index = 0;
      while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index++;
      }
      return `${size.toFixed(2)} ${units[index]}`;
    },
    async loadPage(page) {
      try {
        const response = await fetch(`/api/datasets/private?page=${page}&pageSize=${PAGE_SIZE}`);
        const data = await response.json();
        if (data && data.result) {
          return data.result.data;
        }
        throw new Error('数据格式不正确');
      } catch (err) {
        console.error(`加载第 ${page} 页失败:`, err);
        return [];
      }
    },
    async loadAllPagesAndDetails() {
      try {
        const firstPageResponse = await fetch(`/api/datasets/private?page=1&pageSize=${PAGE_SIZE}`);
        const firstPageData = await firstPageResponse.json();
        if (!firstPageData || !firstPageData.result) {
          throw new Error('数据格式不正确');
        }
        const { totalPage, data: firstPageDatasets } = firstPageData.result;
        this.totalPages = totalPage;
        let allDatasets = [...firstPageDatasets];
        this.loadedPages = 1;
        if (totalPage > 1) {
        const remainingPages = Array.from({ length: totalPage - 1 }, (_, i) => i + 2);
        for (let i = 0; i < remainingPages.length; i += MAX_CONCURRENT_REQUESTS) {
          const batch = remainingPages.slice(i, i + MAX_CONCURRENT_REQUESTS);
          const results = await Promise.all(batch.map(page => this.loadPage(page)));
          results.forEach(datasets => {
            if (datasets && datasets.length > 0) {
                allDatasets = [...allDatasets, ...datasets];
            }
          });
          this.loadedPages += batch.length;
        }
        }
        this.datasets = allDatasets;
        // 并发加载所有数据集详情
        const detailResults = await Promise.all(
          allDatasets.map(ds => fetch(`/api/datasets/${ds.datasetId}/detail`).then(r => r.json().then(data => ({...data, datasetId: ds.datasetId, datasetName: ds.datasetName}))))
        );
        // 构建全局树
        this.treeData = detailResults.map(detail => {
          if (!detail || !detail.result || !detail.result.fileList) return { label: detail.datasetName, children: [] }
          return this.buildTree(detail.result.fileList, detail.datasetName, detail.datasetId)
        });
      } catch (err) {
        console.error('加载数据集失败:', err);
        this.error = '加载数据集失败';
      } finally {
        this.loading = false;
      }
    },
    buildTree(fileList, datasetName = '', datasetId = '') {
      const root = { label: datasetName, children: [], id: datasetId }
      for (const file of fileList) {
        const parts = (file.fileAbs || '').split('/').filter(Boolean)
        let node = root
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]
          if (i < parts.length - 1) {
            let child = node.children.find(c => c.label === part && !c.isFile)
            if (!child) {
              child = { label: part, children: [] }
              node.children.push(child)
            }
            node = child
          } else {
            node.children.push({ label: file.fileName, isFile: true, file, id: file.fileId, datasetId })
          }
        }
        if (parts.length === 0) {
          node.children.push({ label: file.fileName, isFile: true, file, id: file.fileId, datasetId })
        }
      }
      return root
    },
    getFileIcon(contentType, fileName) {
      if (contentType === 'application/octet-stream' || !contentType) {
        const extension = fileName.split('.').pop().toLowerCase();
        const mimeType = EXTENSION_TO_MIME[extension];
        if (mimeType) {
          contentType = mimeType;
        }
      }
      for (const [prefix, icon] of Object.entries(FILE_TYPE_ICONS)) {
        if (contentType.startsWith(prefix)) {
          return icon;
        }
      }
      const specialTypes = {
        'application/json': FILE_TYPE_ICONS['application/json'],
        'application/xml': FILE_TYPE_ICONS['application/xml'],
        'application/pdf': FILE_TYPE_ICONS['application/pdf'],
        'application/zip': FILE_TYPE_ICONS['application/zip'],
        'application/x-rar-compressed': FILE_TYPE_ICONS['application/x-rar-compressed'],
        'application/x-7z-compressed': FILE_TYPE_ICONS['application/x-7z-compressed'],
        'application/octet-stream': FILE_TYPE_ICONS['default']
      };
      return specialTypes[contentType] || FILE_TYPE_ICONS.default;
    },
    async handleDownload(file, datasetId) {
      if (this.downloadingFiles.has(file.fileId)) return;
      try {
        this.downloadingFiles.add(file.fileId);
        file.downloading = true;
        const response = await fetch(`/api/datasets/${datasetId}/files/${file.fileId}/url`);
        const data = await response.json();
        if (data && data.result) {
          const downloadUrl = data.result.fileUrl || data.result.bosUrl;
          if (downloadUrl) {
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.fileName;
            link.rel = 'noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else {
            throw new Error('未获取到下载链接');
          }
        } else {
          throw new Error('获取下载链接失败');
        }
      } catch (error) {
        console.error('下载文件失败:', error);
        ElMessage.error(error.message || '下载失败');
      } finally {
        this.downloadingFiles.delete(file.fileId);
        file.downloading = false;
      }
    },
    async handleDeleteDataset(dataset) {
      try {
        await ElMessageBox.confirm(
          `确定要删除数据集"${dataset.datasetName}"吗？此操作不可恢复。`,
          '删除确认',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        const response = await fetch(`/api/datasets/${dataset.datasetId}`, {
          method: 'DELETE',
          credentials: 'include'
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || '删除失败')
        }
        this.datasets = this.datasets.filter(d => d.datasetId !== dataset.datasetId)
        ElMessage.success('删除成功')
        // 重新加载所有数据集树
        this.loading = true
        await this.loadAllPagesAndDetails()
      } catch (error) {
        if (error === 'cancel') return
        console.error('删除数据集失败:', error)
        ElMessage.error(error.message || '删除失败')
      }
    },
  },
  async created() {
    await this.loadAllPagesAndDetails();
  }
}
</script>

<style scoped>
.dataset-list {
  padding: 20px;
  margin-top: 20px;
  border-top: 1px solid #eee;
}

.datasets-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 800px;
  margin: 0 auto;
}

.dataset-container {
  margin-bottom: 10px;
}

.dataset-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.3s ease;
}

.dataset-item:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.dataset-icon {
  color: #409EFF;
  margin-right: 15px;
  flex-shrink: 0;
}

.dataset-info {
  flex: 1;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dataset-name {
  font-weight: 500;
  margin-bottom: 0;
  word-break: break-word;
}

.dataset-description {
  color: #666;
  margin-bottom: 10px;
}

.dataset-meta {
  display: flex;
  gap: 20px;
  color: #666;
  font-size: 0.9em;
}

.dataset-toggle {
  margin-left: 10px;
  transition: transform 0.3s ease;
}

.dataset-toggle svg {
  transition: transform 0.3s ease;
}

.dataset-toggle svg.is-open {
  transform: rotate(90deg);
}

.dataset-detail {
  margin-top: 10px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.detail-loading,
.detail-error {
  text-align: center;
  padding: 20px;
  color: #666;
}

.detail-error {
  color: #f56c6c;
}

.file-tree {
  margin-top: 10px;
}

.folder-item {
  margin-bottom: 5px;
}

.folder-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.folder-header:hover {
  background: #eef1f6;
}

.folder-icon {
  display: flex;
  align-items: center;
  margin-right: 8px;
  transition: transform 0.2s ease;
}

.folder-icon.is-open {
  transform: rotate(90deg);
}

.folder-name {
  font-weight: 500;
  color: #333;
}

.folder-content {
  margin-left: 24px;
  margin-top: 5px;
  padding-left: 10px;
  border-left: 2px solid #eef1f6;
}

.no-files {
  text-align: center;
  padding: 30px;
  color: #666;
  background: #f9f9f9;
  border-radius: 4px;
  margin-top: 10px;
}

.file-item {
  display: flex;
  align-items: flex-start;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 5px;
  background: #fff;
  transition: all 0.2s ease;
}

.file-item:hover {
  background: #f9f9f9;
  border-color: #ddd;
}

.file-icon {
  margin-right: 12px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.file-name {
  font-weight: 500;
  color: #333;
  word-break: break-all;
}

.file-id {
  color: #999;
  font-size: 0.85em;
  margin-left: 10px;
}

.file-meta {
  display: flex;
  gap: 12px;
  color: #666;
  font-size: 0.9em;
  align-items: center;
}

.file-type {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.85em;
}

.download-link {
  color: #409EFF;
  text-decoration: none;
  padding: 2px 8px;
  border-radius: 3px;
  transition: all 0.2s ease;
}

.download-link:hover {
  background: #ecf5ff;
  color: #66b1ff;
}

.loading-progress {
  padding: 20px;
  text-align: center;
}

.progress-text {
  margin-bottom: 10px;
  color: #666;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #eee;
  border-radius: 2px;
  overflow: hidden;
}

.progress-inner {
  height: 100%;
  background: #409EFF;
  transition: width 0.3s ease;
}

.delete-button {
  margin-left: auto;
  margin-right: 10px;
}

.delete-button:hover {
  background-color: #f56c6c;
  border-color: #f56c6c;
  color: #fff;
}

.dataset-tree {
  background: #fff;
  border-radius: 8px;
  padding: 10px 20px;
  margin-top: 10px;
}

.folder-tree-icon {
  margin-right: 6px;
}

.file-icon {
  margin-right: 6px;
  vertical-align: middle;
}

.file-name {
  margin-right: 8px;
}

.file-type {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.85em;
}

.download-link {
  color: #409EFF;
  text-decoration: none;
  padding: 2px 8px;
  border-radius: 3px;
  transition: all 0.2s ease;
  margin-right: 8px;
}

.download-link:hover {
  background: #ecf5ff;
  color: #66b1ff;
}

.file-id {
  color: #999;
  font-size: 0.85em;
}
</style> 