<template>
  <div class="file-selector">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="服务器文件" name="server">
        <div class="server-file-selector">
          <div class="path-selector">
            <el-select v-model="selectedBasePath" placeholder="选择基础路径" @change="handleBasePathChange">
              <el-option
                v-for="path in basePaths"
                :key="path.value"
                :label="path.label"
                :value="path.value"
              />
            </el-select>
          </div>
          <div class="path-navigation">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item 
                v-for="(item, index) in pathSegments" 
                :key="index"
                @click="navigateToPath(index)"
              >
                {{ item === '.' ? '根目录' : item }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          
          <div v-if="serverFiles.length" class="file-list">
            <el-table 
              :data="serverFiles" 
              style="width: 100%"
              @selection-change="handleServerSelectionChange"
            >
              <el-table-column type="selection" width="55" />
              <el-table-column prop="name" label="文件名">
                <template #default="{ row }">
                  <div class="file-name" @click="handleFileClick(row)">
                    <el-icon v-if="row.type === '文件夹'"><folder /></el-icon>
                    <el-icon v-else><document /></el-icon>
                    <span>{{ row.name }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="100" />
              <el-table-column prop="size" label="大小" width="120">
                <template #default="{ row }">
                  {{ row.type === '文件夹' ? '-' : formatFileSize(row.size) }}
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div v-else-if="!loading" class="empty-state">
            <el-empty description="当前目录为空" />
          </div>
          <div v-if="loading" class="loading-state">
            <el-skeleton :rows="3" animated />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="本地文件" name="local">
        <div class="local-file-selector">
          <el-tabs v-model="localUploadType">
            <el-tab-pane label="选择文件" name="files">
              <el-upload
                class="upload-demo"
                drag
                action="#"
                :auto-upload="false"
                :on-change="handleLocalFileChange"
                :on-remove="handleLocalFileRemove"
                :multiple="true"
                :limit="remainingFileLimit"
              >
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text">
                  拖拽文件到此处或 <em>点击上传</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    最多选择 {{ remainingFileLimit }} 个文件，总大小不超过 {{ constraints.file.maxDatasetSizeGB }}GB
                  </div>
                </template>
              </el-upload>
            </el-tab-pane>

            <el-tab-pane label="选择文件夹" name="folders">
              <div class="folder-upload">
                <input
                  type="file"
                  ref="folderInput"
                  webkitdirectory
                  directory
                  multiple
                  style="display: none"
                  @change="handleFolderInputChange"
                />
                <div 
                  class="folder-drop-zone" 
                  @click="triggerFolderSelect" 
                  @drop.prevent="handleDrop" 
                  @dragover.prevent="handleDragOver"
                  @dragleave.prevent="handleDragLeave"
                  @dragend.prevent="handleDragEnd"
                  :class="{ dragover: isDragging }"
                >
                  <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                  <div class="el-upload__text">
                    拖拽文件夹到此处或 <em>点击选择</em>
                  </div>
                  <div class="folder-tip">
                    最多选择 {{ remainingFileLimit }} 个文件夹，总大小不超过 {{ constraints.file.maxDatasetSizeGB }}GB
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-tab-pane>

      <el-tab-pane label="URL抓取" name="url">
        <div class="url-fetch-selector">
          <el-form :model="urlFetchForm" label-width="100px">
            <el-form-item label="文件URL" required>
              <el-input 
                v-model="urlFetchForm.url" 
                placeholder="请输入文件URL"
                :disabled="isUploading"
              />
            </el-form-item>
            <el-form-item label="文件名" required>
              <el-input 
                v-model="urlFetchForm.fileName" 
                placeholder="请输入文件名"
                :disabled="isUploading"
              />
            </el-form-item>
            <el-form-item label="Referer">
              <el-input 
                v-model="urlFetchForm.referer" 
                placeholder="可选：设置Referer"
                :disabled="isUploading"
              />
            </el-form-item>
            <el-form-item label="User-Agent">
              <el-input 
                v-model="urlFetchForm.userAgent" 
                placeholder="可选：设置User-Agent"
                :disabled="isUploading"
              />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="primary" 
                @click="fetchAndUpload" 
                :loading="isUploading"
                :disabled="!urlFetchForm.url || !urlFetchForm.fileName"
              >
                抓取并上传
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 已选文件列表 -->
    <div v-if="hasSelectedFolders || hasSelectedFiles || selectedLocalFiles.length > 0 || selectedUrlFiles.length > 0" class="selected-files-panel">
      <div class="panel-header">
        <h3>已选文件 ({{ totalSelectedFiles }})</h3>
        <div class="panel-actions">
          <el-button 
            type="primary" 
            @click="showUploadDialog"
            :disabled="!canCreateDataset"
          >
            上传到数据集
          </el-button>
          <el-tooltip 
            v-if="!canCreateDataset"
            :content="`已达到最大数据集数量限制（${maxDatasetCount}个）`"
            placement="top"
          >
            <el-icon class="warning-icon"><warning /></el-icon>
          </el-tooltip>
        </div>
      </div>
      <el-table :data="allSelectedFiles" style="width: 100%">
        <el-table-column prop="name" label="文件名">
          <template #default="{ row }">
            <span v-if="row.folderName">{{ row.folderName }}/{{ row.name }}</span>
            <span v-else>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="size" label="大小">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="100" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button 
              link 
              type="danger" 
              @click="removeSelectedFile(row)"
            >
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="total-size">
        总大小：{{ formatFileSize(totalFileSize) }}
      </div>
    </div>

    <!-- 上传对话框 -->
    <el-dialog
      v-model="uploadDialogVisible"
      :title="isUploading ? '上传进度' : '上传到数据集'"
      width="40%"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="!isUploading"
    >
      <template v-if="!isUploading">
        <el-form :model="datasetForm" label-width="100px">
          <el-form-item label="数据集名称" required>
            <el-input 
              v-model="datasetForm.name" 
              :maxlength="constraints.dataset.maxNameLength"
              show-word-limit
              placeholder="请输入数据集名称"
            />
          </el-form-item>
          <el-form-item label="数据集描述">
            <el-input 
              v-model="datasetForm.description" 
              type="textarea"
              :maxlength="constraints.dataset.maxAbsLength"
              show-word-limit
              placeholder="请输入数据集描述"
            />
          </el-form-item>
          <el-form-item label="标签">
            <el-tag
              v-for="(tag, index) in datasetForm.tags"
              :key="index"
              closable
              @close="removeTag(index)"
              class="mx-1"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-if="inputVisible"
              ref="tagInput"
              v-model="inputValue"
              class="tag-input"
              size="small"
              @keyup.enter="handleInputConfirm"
              @blur="handleInputConfirm"
            />
            <el-button 
              v-else 
              class="button-new-tag" 
              size="small" 
              @click="showInput"
              :disabled="datasetForm.tags.length >= constraints.tag.maxCount"
            >
              + 添加标签
            </el-button>
            <div class="tag-tip">
              最多添加 {{ constraints.tag.maxCount }} 个标签
            </div>
          </el-form-item>
        </el-form>
      </template>
      <template v-else>
        <el-progress 
          :percentage="uploadProgress" 
          :status="uploadStatus"
        />
        <div class="upload-info">
          <p>正在上传：{{ uploadingFileName }}</p>
          <p>进度：{{ uploadProgress }}%</p>
          <p>速度：{{ formatFileSize(uploadSpeed) }}/s</p>
          <p>剩余文件：{{ remainingFiles }}</p>
        </div>
      </template>
      <template #footer>
        <span class="dialog-footer">
          <el-button v-if="!isUploading" @click="uploadDialogVisible = false">取消</el-button>
          <el-button v-if="!isUploading" type="primary" @click="confirmUpload">确认上传</el-button>
          <el-button v-if="isUploading" @click="cancelUpload" :disabled="!canCancel">取消上传</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { UploadFilled, Folder, Document, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { BosClient } from '@baiducloud/sdk'

// 约束条件
const constraints = ref({
  file: {
    maxFileNameLength: 50,
    maxFileAbsLength: 499,
    maxFilesPerDataset: 10,
    maxDatasetSizeGB: 50
  },
  dataset: {
    maxNameLength: 100,
    maxNameDisplayLength: 40,
    maxAbsLength: 200,
    maxCount: 60
  },
  tag: {
    maxLength: 10,
    maxLengthAll: 127,
    maxCount: 5
  }
})

// 获取约束条件
const fetchConstraints = async () => {
  try {
    const response = await fetch('/api/dataset-constraints')
    if (!response.ok) {
      throw new Error('获取约束条件失败')
    }
    constraints.value = await response.json()
  } catch (error) {
    console.error('获取约束条件失败:', error)
    ElMessage.error('获取约束条件失败')
  }
}

// 添加数据集数量状态
const datasetCount = ref(0)
const maxDatasetCount = ref(60)
const canCreateDataset = computed(() => datasetCount.value < maxDatasetCount.value)

// 获取数据集数量
const fetchDatasetCount = async () => {
  try {
    const response = await fetch('/api/datasets/count')
    if (!response.ok) {
      throw new Error('获取数据集数量失败')
    }
    datasetCount.value = await response.json()
  } catch (error) {
    console.error('获取数据集数量失败:', error)
    ElMessage.error('获取数据集数量失败')
  }
}

// 组件挂载时获取约束条件和数据集数量
onMounted(async () => {
  await Promise.all([
    fetchConstraints(),
    fetchDatasetCount()
  ])
  fetchFiles('.')
})

// 基础状态
const activeTab = ref('server')
const currentPath = ref('.')
const serverFiles = ref([])
const loading = ref(false)

// 文件选择状态
const selectedServerFiles = ref([])
const selectedLocalFiles = ref([])
const selectedUrlFiles = ref([])
const currentUploadFiles = ref([])
const selectedServerFolders = ref([])

// 上传状态
const uploadingFiles = ref({})
const uploadingLocal = ref(false)
const uploadDialogVisible = ref(false)
const uploadProgress = ref(0)
const uploadSpeed = ref(0)
const uploadStatus = ref('')
const uploadingFileName = ref('')
const canCancel = ref(true)
const isUploading = ref(false)
const remainingFiles = ref(0)
const bosClient = ref(null)

// 数据集表单
const datasetForm = ref({
  name: '',
  description: '',
  tags: []
})

// 标签输入状态
const inputVisible = ref(false)
const inputValue = ref('')
const tagInput = ref(null)

// URL抓取表单
const urlFetchForm = ref({
  url: '',
  fileName: '',
  referer: '',
  userAgent: ''
})

// 基础路径配置
const basePaths = [
  { label: '项目根目录', value: '.' },
  { label: '上传目录', value: 'uploads' },
  { label: '下载目录', value: 'downloads' }
]

const selectedBasePath = ref('.')

// 计算属性
const pathSegments = computed(() => {
  const segments = currentPath.value.split('/')
  // 如果当前路径是基础路径，只显示一个段
  if (segments.length === 1 && segments[0] === selectedBasePath.value) {
    return [selectedBasePath.value]
  }
  return segments
})

const totalFileSize = computed(() => {
  return currentUploadFiles.value.reduce((total, file) => total + (file.size || 0), 0)
})

const hasSelectedFolders = computed(() => {
  return selectedServerFolders.value.length > 0
})

const hasSelectedFiles = computed(() => {
  return selectedServerFiles.value.length > 0
})

const totalSelectedFiles = computed(() => {
  return selectedServerFiles.value.length + 
         selectedLocalFiles.value.length + 
         selectedUrlFiles.value.length
})

const remainingFileLimit = computed(() => {
  return constraints.value.file.maxFilesPerDataset - totalSelectedFiles.value
})

const allSelectedFiles = computed(() => {
  const serverFiles = []
  
  // 添加直接选择的文件
  serverFiles.push(...selectedServerFiles.value.map(file => ({
    ...file,
    source: '服务器'
  })))

  // 添加文件夹中的文件
  selectedServerFolders.value.forEach(folder => {
    // 这里不需要立即获取文件夹内容，只记录文件夹信息
    serverFiles.push({
      name: folder.name,
      type: '文件夹',
      source: '服务器',
      folderName: folder.name,
      path: folder.path,
      isFolder: true
    })
  })

  const localFiles = selectedLocalFiles.value.map(file => ({
    ...file,
    source: '本地'
  }))

  const urlFiles = selectedUrlFiles.value.map(file => ({
    ...file,
    source: 'URL'
  }))

  return [...serverFiles, ...localFiles, ...urlFiles]
})

// 获取文件列表
const fetchFiles = async (path) => {
  loading.value = true
  try {
    const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
    if (!response.ok) {
      throw new Error('获取文件列表失败')
    }
    const data = await response.json()
    // 为每个文件添加完整路径
    serverFiles.value = data.files.map(file => ({
      ...file,
      path: path === '.' ? file.name : `${path}/${file.name}`
    }))
    currentPath.value = data.currentPath
    console.log('获取到的文件列表:', serverFiles.value)
  } catch (error) {
    ElMessage.error(error.message || '获取文件列表失败')
  } finally {
    loading.value = false
  }
}

// 处理文件点击
const handleFileClick = (file) => {
  if (file.type === '文件夹') {
    const newPath = currentPath.value === '.' ? file.name : `${currentPath.value}/${file.name}`
    fetchFiles(newPath)
  }
}

// 导航到指定路径
const navigateToPath = (index) => {
  const newPath = pathSegments.value.slice(0, index + 1).join('/')
  // 如果导航到根目录，使用选中的基础路径
  if (index === 0) {
    currentPath.value = selectedBasePath.value
  } else {
    currentPath.value = newPath
  }
  fetchFiles(currentPath.value)
}

// 处理服务器文件选择变化
const handleServerSelectionChange = (selection) => {
  console.log('选择的文件/文件夹:', selection)
  // 分别处理文件和文件夹
  selectedServerFiles.value = selection.filter(file => file.type === '文件')
  selectedServerFolders.value = selection.filter(file => file.type === '文件夹').map(folder => ({
    ...folder,
    path: currentPath.value === '.' ? folder.name : `${currentPath.value}/${folder.name}`
  }))
  console.log('处理后的文件:', selectedServerFiles.value)
  console.log('处理后的文件夹:', selectedServerFolders.value)
}

// 获取文件夹下的所有文件（包括子文件夹中的文件）
const getFilesInFolder = async (folderPath, parentPath = '', rootFolderName = '') => {
  try {
    console.log('获取文件夹内容:', {
      folderPath,
      parentPath,
      rootFolderName
    })

    // 确保 folderPath 不为 undefined
    if (!folderPath) {
      throw new Error('文件夹路径不能为空')
    }

    const response = await fetch(`/api/files?path=${encodeURIComponent(folderPath)}`)
    if (!response.ok) {
      throw new Error('获取文件列表失败')
    }
    const data = await response.json()
    
    const files = []
    const folders = []
    const emptyFiles = []  // 用于记录空文件
    
    // 如果是根文件夹，使用其名称作为路径前缀
    const currentPathPrefix = rootFolderName || (parentPath ? '' : folderPath.split('/').pop())
    
    console.log('处理文件夹内容:', {
      currentPathPrefix,
      files: data.files
    })
    
    // 分离文件和文件夹
    data.files.forEach(item => {
      if (item.type === '文件') {
        if (item.size === 0) {
          // 记录空文件，包含完整路径
          const fullPath = [currentPathPrefix, parentPath, item.name].filter(Boolean).join('/')
          emptyFiles.push(fullPath)
        } else {
          // 确保每个文件都有完整的相对路径
          const fullPath = [currentPathPrefix, parentPath, item.name].filter(Boolean).join('/')
          files.push({
            ...item,
            relativePath: fullPath,
            path: `${folderPath}/${item.name}`  // 添加完整路径
          })
        }
      } else if (item.type === '文件夹') {
        const subFolderPath = folderPath === '.' ? item.name : `${folderPath}/${item.name}`
        folders.push({
          ...item,
          path: subFolderPath
        })
      }
    })
    
    // 如果有空文件，显示提示
    if (emptyFiles.length > 0) {
      const folderDisplayName = [currentPathPrefix, parentPath].filter(Boolean).join('/') || '当前文件夹'
      ElMessage.warning(`${folderDisplayName} 中发现 ${emptyFiles.length} 个空文件，将被忽略：${emptyFiles.join(', ')}`)
    }
    
    // 递归获取子文件夹中的文件
    for (const folder of folders) {
      try {
        // 构建子文件夹的完整路径
        const subFolderPath = [parentPath, folder.name].filter(Boolean).join('/')
        const { files: subFiles, emptyFiles: subEmptyFiles } = await getFilesInFolder(
          folder.path, 
          subFolderPath,
          currentPathPrefix  // 传递根文件夹名称
        )
        
        // 添加子文件夹中的文件
        files.push(...subFiles)
        
        // 如果有子文件夹中的空文件，显示提示
        if (subEmptyFiles.length > 0) {
          const subFolderDisplayPath = [currentPathPrefix, subFolderPath].filter(Boolean).join('/')
          ElMessage.warning(`子文件夹 ${subFolderDisplayPath} 中发现 ${subEmptyFiles.length} 个空文件，将被忽略：${subEmptyFiles.join(', ')}`)
        }
      } catch (error) {
        console.error(`获取子文件夹 ${folder.name} 内容失败:`, error)
        ElMessage.warning(`获取子文件夹 ${folder.name} 内容失败: ${error.message}`)
      }
    }
    
    return {
      files,
      emptyFiles
    }
  } catch (error) {
    console.error('获取文件夹文件失败:', error)
    throw error
  }
}

// 检查是否同域
const isSameOrigin = () => {
  try {
    const currentOrigin = window.location.origin
    const aiStudioOrigin = new URL(import.meta.env.VITE_AI_STUDIO_URL || 'https://aistudio.baidu.com').origin
    return currentOrigin === aiStudioOrigin
  } catch (error) {
    console.error('检查同域失败:', error)
    return false
  }
}

// 初始化BOS客户端
const initBosClient = async () => {
  try {
    // 只在同域时尝试浏览器直接上传
    if (!isSameOrigin()) {
      console.log('非同域环境，使用服务器上传')
      return null
    }

    // 同域时直接使用浏览器cookie
    const response = await fetch('/api/get-bos-client', {
      credentials: 'include'  // 包含cookie
    })
    
    if (!response.ok) {
      throw new Error('获取BOS客户端失败')
    }
    
    const { endpoint, bucketName } = await response.json()
    
    // 创建BOS客户端，使用浏览器cookie
    bosClient.value = new BosClient({
      endpoint,
      credentials: {
        // 同域时不需要显式提供ak/sk，会使用cookie
        sessionToken: true
      }
    })
    
    return { bucketName }
  } catch (error) {
    console.error('初始化BOS客户端失败:', error)
    return null
  }
}

// 浏览器直接上传到BOS
const uploadToBos = async (file, options = {}) => {
  if (!bosClient.value) {
    const result = await initBosClient()
    if (!result) {
      throw new Error('无法初始化BOS客户端')
    }
    options.bucketName = result.bucketName
  }

  const { bucketName, onProgress } = options
  const fileKey = `uploads/${Date.now()}_${file.name}`

  try {
    const uploadTask = bosClient.value.putSuperObject({
      bucketName,
      objectName: fileKey,
      data: file,
      partConcurrency: 2,
      onProgress: (progress) => {
        if (onProgress) {
          onProgress(progress)
        }
      }
    })

    await uploadTask.start()
    return { fileKey, bucketName }
  } catch (error) {
    console.error('浏览器上传到BOS失败:', error)
    throw error
  }
}

// 浏览器直接抓取URL到BOS
const fetchToBos = async (url, fileName, options = {}) => {
  if (!bosClient.value) {
    const result = await initBosClient()
    if (!result) {
      throw new Error('无法初始化BOS客户端')
    }
    options.bucketName = result.bucketName
  }

  const { bucketName, referer, userAgent } = options
  const fileKey = `uploads/${Date.now()}_${fileName}`

  try {
    const fetchOptions = {
      'x-bce-fetch-source': url
    }
    if (referer) {
      fetchOptions['x-bce-fetch-referer'] = referer
    }
    if (userAgent) {
      fetchOptions['x-bce-fetch-user-agent'] = userAgent
    }

    const uploadTask = bosClient.value.fetchObject(bucketName, fileKey, fetchOptions)
    await uploadTask.start()
    return { fileKey, bucketName }
  } catch (error) {
    console.error('浏览器抓取到BOS失败:', error)
    throw error
  }
}

// 在 script setup 部分添加新的状态和方法
const localUploadType = ref('files')
const folderInput = ref(null)

// 处理本地文件选择
const handleLocalFileChange = async (file, fileList) => {
  try {
    const files = []
    const emptyFiles = []  // 用于记录空文件
    
    for (const f of fileList) {
      // 检查文件大小
      if (f.size === 0) {
        emptyFiles.push(f.name)
        continue
      }
      
      // 检查是否同域
      if (!isSameOrigin()) {
        // 非同域直接使用服务器上传
        files.push(await uploadViaServer(f))
      } else {
        try {
          // 同域时尝试浏览器直接上传
          const { fileKey, bucketName } = await uploadToBos(f.raw, {
            onProgress: (progress) => {
              console.log(`文件 ${f.name} 上传进度:`, progress)
            }
          })

          // 添加到数据集
          const response = await fetch('/api/add-file-to-dataset', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              fileName: f.name,
              fileKey,
              bucketName
            })
          })

          if (!response.ok) {
            throw new Error('添加到数据集失败')
          }

          const result = await response.json()
          if (!result.success) {
            throw new Error(result.error || '添加到数据集失败')
          }

          files.push({
            name: f.name,
            size: f.size,
            raw: f.raw,
            source: '本地',
            fileId: result.fileId
          })
        } catch (error) {
          console.error(`文件 ${f.name} 浏览器上传失败，尝试服务器上传:`, error)
          files.push(await uploadViaServer(f))
        }
      }
    }
    
    // 如果有空文件，显示提示
    if (emptyFiles.length > 0) {
      ElMessage.warning(`发现 ${emptyFiles.length} 个空文件，将被忽略：${emptyFiles.join(', ')}`)
    }
    
    selectedLocalFiles.value = files
  } catch (error) {
    ElMessage.error(error.message || '文件上传失败')
  }
}

// 处理本地文件移除
const handleLocalFileRemove = (file, fileList) => {
  selectedLocalFiles.value = fileList.map(f => ({
    name: f.name,
    size: f.size,
    raw: f.raw,
    source: '本地'
  }))
}

// 显示标签输入框
const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    tagInput.value?.focus()
  })
}

// 处理标签输入确认
const handleInputConfirm = () => {
  if (inputValue.value) {
    if (datasetForm.value.tags.length >= constraints.value.tag.maxCount) {
      ElMessage.warning(`最多添加 ${constraints.value.tag.maxCount} 个标签`)
      return
    }
    const totalLength = datasetForm.value.tags.join('').length + inputValue.value.length
    if (totalLength > constraints.value.tag.maxLengthAll) {
      ElMessage.warning(`所有标签总长度不能超过 ${constraints.value.tag.maxLengthAll} 个字符`)
      return
    }
    datasetForm.value.tags.push(inputValue.value)
  }
  inputVisible.value = false
  inputValue.value = ''
}

// 移除标签
const removeTag = (index) => {
  datasetForm.value.tags.splice(index, 1)
}

// 验证数据集表单
const validateDatasetForm = () => {
  if (!datasetForm.value.name) {
    ElMessage.warning('请输入数据集名称')
    return false
  }
  if (datasetForm.value.name.length > constraints.value.dataset.maxNameLength) {
    ElMessage.warning(`数据集名称长度不能超过 ${constraints.value.dataset.maxNameLength} 个字符`)
    return false
  }
  if (datasetForm.value.description.length > constraints.value.dataset.maxAbsLength) {
    ElMessage.warning(`数据集描述长度不能超过 ${constraints.value.dataset.maxAbsLength} 个字符`)
    return false
  }
  return true
}

// 显示上传对话框
const showUploadDialog = () => {
  if (totalSelectedFiles.value === 0) {
    ElMessage.warning('请选择要上传的文件')
    return
  }

  if (!canCreateDataset.value) {
    ElMessage.error(`已达到最大数据集数量限制（${maxDatasetCount.value}个），无法创建新数据集`)
    return
  }

  datasetForm.value.name = `数据集_${new Date().toLocaleString()}`
  datasetForm.value.description = '通过文件选择器上传的文件'
  datasetForm.value.tags = []
  uploadDialogVisible.value = true
  isUploading.value = false
}

// 移除已选文件
const removeSelectedFile = (file) => {
  if (file.source === '服务器') {
    if (file.isFolder) {
      // 如果是文件夹，从文件夹列表中移除
      const folderIndex = selectedServerFolders.value.findIndex(f => f.name === file.name)
      if (folderIndex !== -1) {
        selectedServerFolders.value.splice(folderIndex, 1)
      }
    } else if (file.folderName) {
      // 如果是文件夹中的文件，从文件夹列表中移除
      const folderIndex = selectedServerFolders.value.findIndex(f => f.name === file.folderName)
      if (folderIndex !== -1) {
        selectedServerFolders.value.splice(folderIndex, 1)
      }
    } else {
      // 如果是直接选择的文件，从文件列表中移除
      const index = selectedServerFiles.value.findIndex(f => f.path === file.path)
      if (index !== -1) {
        selectedServerFiles.value.splice(index, 1)
      }
    }
  } else if (file.source === '本地') {
    const index = selectedLocalFiles.value.findIndex(f => f.name === file.name)
    if (index !== -1) {
      selectedLocalFiles.value.splice(index, 1)
    }
  } else if (file.source === 'URL') {
    const index = selectedUrlFiles.value.findIndex(f => f.fileId === file.fileId)
    if (index !== -1) {
      selectedUrlFiles.value.splice(index, 1)
    }
  }
}

// 确认上传
const confirmUpload = async () => {
  if (!validateDatasetForm()) {
    return
  }

  try {
    // 检查数据集数量是否超过限制
    const countResponse = await fetch('/api/datasets/count')
    if (!countResponse.ok) {
      throw new Error('获取数据集数量失败')
    }
    const count = await countResponse.json()
    if (count >= maxDatasetCount.value) {
      ElMessage.error(`创建失败：已达到最大数据集数量限制（${maxDatasetCount.value}个）`)
      return
    }

    isUploading.value = true
    uploadProgress.value = 0
    uploadSpeed.value = 0
    uploadStatus.value = ''
    canCancel.value = true
    currentUploadFiles.value = []
    
    // 计算总文件数
    let totalFiles = 0
    let totalEmptyFiles = 0  // 用于统计总空文件数
    const fileIds = []  // 用于收集所有文件的 fileId
    const fileAbsList = []  // 用于收集所有文件的相对路径

    // 先处理文件夹，获取所有文件
    if (selectedServerFolders.value.length > 0) {
      for (const folder of selectedServerFolders.value) {
        try {
          const { files: folderFiles, emptyFiles } = await getFilesInFolder(
            folder.path,
            '',  // 初始父路径为空
            folder.name  // 使用文件夹名称作为根路径
          )
          totalFiles += folderFiles.length
          totalEmptyFiles += emptyFiles.length
        } catch (error) {
          console.error(`获取文件夹 ${folder.name} 内容失败:`, error)
          ElMessage.warning(`获取文件夹 ${folder.name} 内容失败: ${error.message}`)
        }
      }
    }

    // 计算直接选择的服务器文件数（排除空文件）
    totalFiles += selectedServerFiles.value.filter(file => file.size > 0).length
    totalEmptyFiles += selectedServerFiles.value.filter(file => file.size === 0).length
    
    // 计算本地文件数
    totalFiles += selectedLocalFiles.value.length
    
    // 计算URL文件数
    totalFiles += selectedUrlFiles.value.length
    
    // 设置remainingFiles为总文件数
    remainingFiles.value = totalFiles
    const totalFilesToUpload = totalFiles  // 保存总文件数用于计算进度

    console.log('开始处理上传，当前路径:', currentPath.value)
    console.log('选中的基础路径:', selectedBasePath.value)
    console.log('总文件数:', totalFiles)
    console.log('空文件数:', totalEmptyFiles)

    let totalEmptyFilesProcessed = 0  // 用于统计已处理的空文件数

    // 处理选中的文件夹
    if (selectedServerFolders.value.length > 0) {
      console.log('处理选中的文件夹:', selectedServerFolders.value)
      for (const folder of selectedServerFolders.value) {
        console.log('处理文件夹:', folder)
        try {
          // 使用文件夹名称作为根路径
          const { files: folderFiles, emptyFiles } = await getFilesInFolder(
            folder.path,
            '',  // 初始父路径为空
            folder.name  // 使用文件夹名称作为根路径
          )
          console.log('获取到的文件夹内容:', folderFiles)
          totalEmptyFilesProcessed += emptyFiles.length
          
          // 处理文件夹中的文件
          for (const file of folderFiles) {
            const relativePath = file.relativePath
            const pathParts = relativePath.split('/')
            const fileName = pathParts.pop()  // 获取文件名
            const folderPath = pathParts.join('/')  // 获取文件夹路径
            
            console.log('处理文件夹中的文件:', {
              originalPath: file.path,
              relativePath,
              fileName,
              folderPath
            })

            // 上传文件
            const response = await fetch('/api/upload-to-dataset', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({
                filePath: file.path,
                fileName: fileName,
                folderPath: folderPath,
                currentPath: currentPath.value,
                selectedBasePath: selectedBasePath.value
              })
            })

            if (!response.ok) {
              const result = await response.json()
              throw new Error(result.error || '上传失败')
            }

            const result = await response.json()
            if (!result.success) {
              throw new Error(result.error || '上传失败')
            }

            fileIds.push(result.fileId)
            fileAbsList.push(result.fileAbs)
            remainingFiles.value--
            if (totalFilesToUpload === 0) {
              uploadProgress.value = 0
            } else {
              uploadProgress.value = Math.min(100, Math.round((totalFilesToUpload - remainingFiles.value) / totalFilesToUpload * 100))
            }
          }
        } catch (error) {
          console.error(`获取文件夹 ${folder.name} 内容失败:`, error)
          ElMessage.warning(`获取文件夹 ${folder.name} 内容失败: ${error.message}`)
        }
      }
    }

    // 添加直接选中的文件（排除空文件）
    const validServerFiles = selectedServerFiles.value.filter(file => file.size > 0)
    const emptyServerFiles = selectedServerFiles.value.filter(file => file.size === 0)
    totalEmptyFilesProcessed += emptyServerFiles.length
    
    console.log('直接选中的有效文件:', validServerFiles)
    
    if (emptyServerFiles.length > 0) {
      ElMessage.warning(`发现 ${emptyServerFiles.length} 个空文件，将被忽略：${emptyServerFiles.map(f => f.name).join(', ')}`)
    }
    
    // 处理直接选择的文件
    for (const file of validServerFiles) {
      console.log('处理直接选择的文件:', {
        originalPath: file.path,
        name: file.name,
        currentPath: currentPath.value
      })
      
      if (!file.path) {
        console.error('文件缺少路径信息:', file)
        throw new Error(`文件 ${file.name} 缺少路径信息`)
      }

      // 上传文件
      const response = await fetch('/api/upload-to-dataset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          filePath: file.path,
          fileName: file.name,
          currentPath: currentPath.value,
          selectedBasePath: selectedBasePath.value
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '上传失败')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || '上传失败')
    }

      fileIds.push(result.fileId)
      fileAbsList.push(result.fileAbs)
      remainingFiles.value--
      if (totalFilesToUpload === 0) {
        uploadProgress.value = 0
      } else {
        uploadProgress.value = Math.min(100, Math.round((totalFilesToUpload - remainingFiles.value) / totalFilesToUpload * 100))
      }
    }

    // 添加本地文件（已在handleLocalFileChange中过滤空文件）
    for (const file of selectedLocalFiles.value) {
        const formData = new FormData()
        formData.append('file', file.raw)
        formData.append('datasetName', datasetForm.value.name)
        formData.append('datasetAbs', datasetForm.value.description)
        formData.append('tags', JSON.stringify(datasetForm.value.tags))

        const response = await fetch('/api/upload-local-to-dataset', {
          method: 'POST',
          credentials: 'include',
          body: formData
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || '上传失败')
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || '上传失败')
        }

      fileIds.push(result.fileId)
      fileAbsList.push(file.relativePath || file.name)
      remainingFiles.value--
      if (totalFilesToUpload === 0) {
        uploadProgress.value = 0
      } else {
        uploadProgress.value = Math.min(100, Math.round((totalFilesToUpload - remainingFiles.value) / totalFilesToUpload * 100))
      }
    }

    // 添加URL抓取的文件
    for (const file of selectedUrlFiles.value) {
      fileIds.push(file.fileId)
      fileAbsList.push(file.name)
      remainingFiles.value--
      if (totalFilesToUpload === 0) {
        uploadProgress.value = 0
      } else {
        uploadProgress.value = Math.min(100, Math.round((totalFilesToUpload - remainingFiles.value) / totalFilesToUpload * 100))
      }
    }

    if (fileIds.length === 0) {
      throw new Error('未选择任何有效文件')
    }

    // 如果有空文件被忽略，显示总结提示
    if (totalEmptyFilesProcessed > 0) {
      ElMessage.info(`已忽略 ${totalEmptyFilesProcessed} 个空文件，继续上传 ${fileIds.length} 个有效文件`)
    }

    // 创建数据集
    const response = await fetch('/api/create-dataset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        datasetName: datasetForm.value.name,
        datasetAbs: datasetForm.value.description,
        tags: datasetForm.value.tags,
        fileIds,
        fileAbsList
      })
    })

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || '创建数据集失败')
    }

    const result = await response.json()
    if (result.success) {
      uploadStatus.value = 'success'
      ElMessage.success(`上传成功，数据集ID: ${result.datasetId}`)
      // 清空已选文件
      selectedServerFiles.value = []
      selectedServerFolders.value = []
      selectedLocalFiles.value = []
      selectedUrlFiles.value = []
    } else {
      throw new Error(result.error || '创建数据集失败')
    }
  } catch (error) {
    uploadStatus.value = 'exception'
    ElMessage.error(error.message || '上传失败')
  } finally {
    isUploading.value = false
    canCancel.value = false
    setTimeout(() => {
      uploadDialogVisible.value = false
    }, 2000)
  }
}

// 取消上传
const cancelUpload = () => {
  uploadDialogVisible.value = false
  ElMessage.info('上传已取消')
}

// 格式化文件大小
const formatFileSize = (size) => {
  if (!size) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(size) / Math.log(k))
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 抓取并上传
const fetchAndUpload = async () => {
  if (!urlFetchForm.value.url || !urlFetchForm.value.fileName) {
    ElMessage.warning('请输入文件URL和文件名')
    return
  }

  try {
    isUploading.value = true
    uploadProgress.value = 0
    uploadSpeed.value = 0
    uploadStatus.value = ''
    uploadingFileName.value = urlFetchForm.value.fileName
    canCancel.value = true

    // 检查是否同域
    if (!isSameOrigin()) {
      // 非同域直接使用服务器抓取
      await fetchViaServer()
      return
    }

    try {
      // 同域时尝试浏览器直接抓取
      const { fileKey, bucketName } = await fetchToBos(
        urlFetchForm.value.url,
        urlFetchForm.value.fileName,
        {
          referer: urlFetchForm.value.referer,
          userAgent: urlFetchForm.value.userAgent
        }
      )

      // 添加到数据集
      const response = await fetch('/api/add-file-to-dataset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',  // 包含cookie
        body: JSON.stringify({
          fileName: urlFetchForm.value.fileName,
          fileKey,
          bucketName
        })
      })

      if (!response.ok) {
        throw new Error('添加到数据集失败')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || '添加到数据集失败')
      }

      // 添加到已选文件列表
      selectedUrlFiles.value.push({
        name: urlFetchForm.value.fileName,
        fileId: result.fileId,
        source: 'URL'
      })

      uploadStatus.value = 'success'
      ElMessage.success('文件抓取成功，已添加到待上传列表')
    } catch (error) {
      console.error('浏览器抓取失败，尝试服务器抓取:', error)
      await fetchViaServer()
    }

    // 清空表单
    urlFetchForm.value = {
      url: '',
      fileName: '',
      referer: '',
      userAgent: ''
    }
  } catch (error) {
    uploadStatus.value = 'exception'
    ElMessage.error(error.message || '抓取上传失败')
  } finally {
    isUploading.value = false
    canCancel.value = false
    uploadDialogVisible.value = false
  }
}

// 通过服务器抓取文件
const fetchViaServer = async () => {
  const response = await fetch('/api/fetch-to-dataset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',  // 包含cookie
    body: JSON.stringify({
      url: urlFetchForm.value.url,
      fileName: urlFetchForm.value.fileName,
      referer: urlFetchForm.value.referer || undefined,
      userAgent: urlFetchForm.value.userAgent || undefined
    })
  })

  if (!response.ok) {
    const result = await response.json()
    throw new Error(result.error || '抓取上传失败')
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || '抓取上传失败')
  }

  // 添加到已选文件列表
  selectedUrlFiles.value.push({
    name: urlFetchForm.value.fileName,
    fileId: result.fileId,
    source: 'URL'
  })

  uploadStatus.value = 'success'
  ElMessage.success('文件抓取成功，已添加到待上传列表')
}

// 通过服务器上传文件
const uploadViaServer = async (file) => {
  const formData = new FormData()
  formData.append('file', file.raw)

  const response = await fetch('/api/upload-local-to-dataset', {
    method: 'POST',
    credentials: 'include',  // 包含cookie
    body: formData
  })

  if (!response.ok) {
    throw new Error('服务器上传失败')
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || '服务器上传失败')
  }

  return {
    name: file.name,
    size: file.size,
    raw: file.raw,
    source: '本地',
    fileId: result.fileId
  }
}

// 修改文件夹选择处理函数
const handleFolderInputChange = async (event) => {
  const inputFiles = Array.from(event.target.files || [])
  if (inputFiles.length === 0) return

  try {
    const processedFiles = []
    const emptyFiles = []
    const folderMap = new Map()

    // 处理所有文件
    for (const file of inputFiles) {
      if (!file.webkitRelativePath) {
        continue // 跳过非文件夹中的文件
      }

      const pathParts = file.webkitRelativePath.split('/')
      const folderName = pathParts[0]
      const fileName = pathParts[pathParts.length - 1]
      
      // 检查文件大小
      if (file.size === 0) {
        emptyFiles.push(file.webkitRelativePath)
        continue
      }

      // 构建文件夹结构
      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, [])
      }
      folderMap.get(folderName).push({
        name: fileName,
        size: file.size,
        raw: file,
        relativePath: file.webkitRelativePath
      })
    }

    // 处理每个文件夹中的文件
    for (const [folderName, folderFiles] of folderMap) {
      for (const file of folderFiles) {
        try {
          // 检查是否同域
          if (!isSameOrigin()) {
            // 非同域直接使用服务器上传
            const uploadedFile = await uploadViaServer(file)
            processedFiles.push({
              ...uploadedFile,
              folderName,
              relativePath: file.relativePath
            })
          } else {
            try {
              // 同域时尝试浏览器直接上传
              const { fileKey, bucketName } = await uploadToBos(file.raw, {
                onProgress: (progress) => {
                  console.log(`文件 ${file.relativePath} 上传进度:`, progress)
                }
              })

              // 添加到数据集
              const response = await fetch('/api/add-file-to-dataset', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                  fileName: file.relativePath,
                  fileKey,
                  bucketName
                })
              })

              if (!response.ok) {
                throw new Error('添加到数据集失败')
              }

              const result = await response.json()
              if (!result.success) {
                throw new Error(result.error || '添加到数据集失败')
              }

              processedFiles.push({
                name: file.name,
                size: file.size,
                raw: file.raw,
                source: '本地',
                folderName,
                relativePath: file.relativePath,
                fileId: result.fileId
              })
            } catch (error) {
              console.error(`文件 ${file.relativePath} 浏览器上传失败，尝试服务器上传:`, error)
              const uploadedFile = await uploadViaServer(file)
              processedFiles.push({
                ...uploadedFile,
                folderName,
                relativePath: file.relativePath
              })
            }
          }
        } catch (error) {
          console.error(`处理文件 ${file.relativePath} 失败:`, error)
          ElMessage.warning(`处理文件 ${file.relativePath} 失败: ${error.message}`)
        }
      }
    }

    // 如果有空文件，显示提示
    if (emptyFiles.length > 0) {
      ElMessage.warning(`发现 ${emptyFiles.length} 个空文件，将被忽略：${emptyFiles.join(', ')}`)
    }

    // 保留之前选择的文件，添加新处理的文件
    selectedLocalFiles.value = [...selectedLocalFiles.value, ...processedFiles]

    // 检查是否超过文件数量限制
    if (selectedLocalFiles.value.length > constraints.value.file.maxFilesPerDataset) {
      ElMessage.warning(`文件数量超过限制，最多只能选择 ${constraints.value.file.maxFilesPerDataset} 个文件`)
      selectedLocalFiles.value = selectedLocalFiles.value.slice(0, constraints.value.file.maxFilesPerDataset)
    }

    // 检查是否超过总大小限制
    const totalSize = selectedLocalFiles.value.reduce((sum, file) => sum + file.size, 0)
    const maxSize = constraints.value.file.maxDatasetSizeGB * 1024 * 1024 * 1024
    if (totalSize > maxSize) {
      ElMessage.warning(`文件总大小超过限制，最多只能上传 ${constraints.value.file.maxDatasetSizeGB}GB`)
      // 移除超出限制的文件
      let currentSize = 0
      selectedLocalFiles.value = selectedLocalFiles.value.filter(file => {
        if (currentSize + file.size <= maxSize) {
          currentSize += file.size
          return true
        }
        return false
      })
    }
  } catch (error) {
    ElMessage.error(error.message || '文件夹上传失败')
  }
}

// 触发文件夹选择
const triggerFolderSelect = () => {
  folderInput.value?.click()
}

// 修改拖放相关的状态和方法
const isDragging = ref(false)

// 移除拖放事件的防抖，因为这些事件需要立即响应
const handleDragOver = (event) => {
  isDragging.value = true
  event.dataTransfer.dropEffect = 'copy'
}

const handleDragLeave = (event) => {
  isDragging.value = false
}

const handleDragEnd = (event) => {
  isDragging.value = false
}

// 直接处理拖放事件，不使用防抖
const handleDrop = async (event) => {
  event.preventDefault()
  isDragging.value = false
  
  const items = event.dataTransfer.items
  if (!items) {
    ElMessage.warning('您的浏览器不支持文件夹拖放')
    return
  }

  try {
    const processedFiles = []
    const emptyFiles = []
    const folderMap = new Map()

    // 处理每个拖放的项目
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry()
        if (entry && entry.isDirectory) {
          await processDirectoryEntry(entry, folderMap, emptyFiles)
        }
      }
    }

    // 处理每个文件夹中的文件
    for (const [folderName, folderFiles] of folderMap) {
      for (const file of folderFiles) {
        try {
          // 检查是否同域
          if (!isSameOrigin()) {
            // 非同域直接使用服务器上传
            const uploadedFile = await uploadViaServer(file)
            processedFiles.push({
              ...uploadedFile,
              folderName,
              relativePath: file.relativePath
            })
          } else {
            try {
              // 同域时尝试浏览器直接上传
              const { fileKey, bucketName } = await uploadToBos(file.raw, {
                onProgress: (progress) => {
                  console.log(`文件 ${file.relativePath} 上传进度:`, progress)
                }
              })

              // 添加到数据集
              const response = await fetch('/api/add-file-to-dataset', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                  fileName: file.relativePath,
                  fileKey,
                  bucketName
                })
              })

              if (!response.ok) {
                throw new Error('添加到数据集失败')
              }

              const result = await response.json()
              if (!result.success) {
                throw new Error(result.error || '添加到数据集失败')
              }

              processedFiles.push({
                name: file.name,
                size: file.size,
                raw: file.raw,
                source: '本地',
                folderName,
                relativePath: file.relativePath,
                fileId: result.fileId
              })
            } catch (error) {
              console.error(`文件 ${file.relativePath} 浏览器上传失败，尝试服务器上传:`, error)
              const uploadedFile = await uploadViaServer(file)
              processedFiles.push({
                ...uploadedFile,
                folderName,
                relativePath: file.relativePath
              })
            }
          }
        } catch (error) {
          console.error(`处理文件 ${file.relativePath} 失败:`, error)
          ElMessage.warning(`处理文件 ${file.relativePath} 失败: ${error.message}`)
        }
      }
    }

    // 如果有空文件，显示提示
    if (emptyFiles.length > 0) {
      ElMessage.warning(`发现 ${emptyFiles.length} 个空文件，将被忽略：${emptyFiles.join(', ')}`)
    }

    // 保留之前选择的文件，添加新处理的文件
    selectedLocalFiles.value = [...selectedLocalFiles.value, ...processedFiles]

    // 检查是否超过文件数量限制
    if (selectedLocalFiles.value.length > constraints.value.file.maxFilesPerDataset) {
      ElMessage.warning(`文件数量超过限制，最多只能选择 ${constraints.value.file.maxFilesPerDataset} 个文件`)
      selectedLocalFiles.value = selectedLocalFiles.value.slice(0, constraints.value.file.maxFilesPerDataset)
    }

    // 检查是否超过总大小限制
    const totalSize = selectedLocalFiles.value.reduce((sum, file) => sum + file.size, 0)
    const maxSize = constraints.value.file.maxDatasetSizeGB * 1024 * 1024 * 1024
    if (totalSize > maxSize) {
      ElMessage.warning(`文件总大小超过限制，最多只能上传 ${constraints.value.file.maxDatasetSizeGB}GB`)
      // 移除超出限制的文件
      let currentSize = 0
      selectedLocalFiles.value = selectedLocalFiles.value.filter(file => {
        if (currentSize + file.size <= maxSize) {
          currentSize += file.size
          return true
        }
        return false
      })
    }
  } catch (error) {
    ElMessage.error(error.message || '文件夹上传失败')
  }
}

// 处理目录条目
const processDirectoryEntry = async (entry, folderMap, emptyFiles, parentPath = '') => {
  const folderName = parentPath ? `${parentPath}/${entry.name}` : entry.name
  if (!folderMap.has(folderName)) {
    folderMap.set(folderName, [])
  }

  const reader = entry.createReader()
  const entries = await new Promise((resolve) => {
    reader.readEntries(resolve)
  })

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise((resolve) => {
        entry.file(resolve)
      })
      
      if (file.size === 0) {
        emptyFiles.push(`${folderName}/${file.name}`)
        continue
      }

      const folder = folderMap.get(folderName)
      folder.push({
        name: file.name,
        size: file.size,
        raw: file,
        relativePath: `${folderName}/${file.name}`
      })
    } else if (entry.isDirectory) {
      await processDirectoryEntry(entry, folderMap, emptyFiles, folderName)
    }
  }
}

// 处理基础路径变化
const handleBasePathChange = (path) => {
  console.log('基础路径变化:', path)
  currentPath.value = path
  fetchFiles(path)
}
</script>

<style scoped>
.file-selector {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.path-selector {
  margin-bottom: 20px;
}

.path-selector :deep(.el-select) {
  width: 100%;
}

.path-navigation {
  margin-bottom: 20px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.file-list {
  margin-top: 20px;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.file-name:hover {
  color: #409EFF;
}

.selected-files-panel {
  margin-top: 20px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.panel-header h3 {
  margin: 0;
  color: #409EFF;
}

.total-size {
  margin-top: 10px;
  text-align: right;
  color: #606266;
  font-size: 14px;
}

.local-file-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

:deep(.el-upload-dragger) {
  width: 100%;
}

.empty-state,
.loading-state {
  margin-top: 20px;
  padding: 40px;
  text-align: center;
}

:deep(.el-breadcrumb__item) {
  cursor: pointer;
}

:deep(.el-breadcrumb__item:hover) {
  color: #409EFF;
}

.upload-info {
  margin-top: 15px;
  text-align: center;
}

.upload-info p {
  margin: 5px 0;
  color: #606266;
}

.tag-input {
  width: 100px;
  margin-left: 10px;
  vertical-align: bottom;
}

.button-new-tag {
  margin-left: 10px;
  height: 32px;
  padding-top: 0;
  padding-bottom: 0;
}

.tag-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.mx-1 {
  margin: 0 5px 5px 0;
}

:deep(.el-upload-list) {
  max-height: 300px;
  overflow-y: auto;
}

.url-fetch-selector {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.url-fetch-selector :deep(.el-form-item__label) {
  font-weight: bold;
}

.url-fetch-selector :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}

.url-fetch-selector :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c0c4cc inset;
}

.url-fetch-selector :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #409eff inset;
}

.panel-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.warning-icon {
  color: #e6a23c;
  font-size: 18px;
  margin-left: 4px;
}

.local-file-selector :deep(.el-upload-dragger) {
  width: 100%;
  height: auto;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.local-file-selector :deep(.el-upload-dragger .el-icon--upload) {
  font-size: 48px;
  margin-bottom: 16px;
}

.local-file-selector :deep(.el-upload-dragger .el-upload__text) {
  font-size: 16px;
  line-height: 1.5;
  text-align: center;
}

.local-file-selector :deep(.el-upload-dragger .el-upload__tip) {
  margin-top: 16px;
  font-size: 14px;
  color: #909399;
}

.folder-upload {
  padding: 20px;
}

.folder-drop-zone {
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  user-select: none;
}

.folder-drop-zone:hover {
  border-color: #409EFF;
  background-color: #f5f7fa;
}

.folder-drop-zone.dragover {
  border-color: #409EFF;
  background-color: #ecf5ff;
  transform: scale(1.02);
}

.folder-drop-zone .el-icon--upload {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 16px;
}

.folder-drop-zone .el-upload__text {
  font-size: 16px;
  color: #606266;
  margin-bottom: 16px;
}

.folder-drop-zone .el-upload__text em {
  color: #409EFF;
  font-style: normal;
}

.folder-tip {
  color: #909399;
  font-size: 14px;
}
</style> 