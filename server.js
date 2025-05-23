import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join, normalize, relative } from 'path'
import { readdir, stat, readFile } from 'fs/promises'
import { createServer as createViteServer } from 'vite'
import { AI_Studio, validateDatasetParams } from './src/api/aistudio.js'
import { ALLOWED_PATHS } from './src/config/paths.js'
import multer from 'multer'
import fs from 'fs'
import {
  logger,
  logPerformance,
  logSystemResources,
  logError,
  logSecurity,
  logBusiness,
  requestLogger
} from './src/config/logger.js'

// 数据集约束条件
const DATASET_CONSTRAINTS = {
  MAX_FILE_NAME_LENGTH: 50,
  MAX_DATASET_NAME_DISPLAY_LENGTH: 40,
  MAX_DATASET_NAME_LENGTH: 100,
  MAX_DATASET_ABS_LENGTH: 200,
  MAX_TAG_LENGTH: 10,
  MAX_TAG_LENGTH_ALL: 127,
  MAX_TAGS_COUNT: 5,
  MAX_FILE_ABS_LENGTH: 499,
  MAX_FILES_PER_DATASET: 10,
  MAX_DATASET_SIZE_GB: 50,
  MAX_DATASETS_COUNT: 60
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 检查路径是否在允许范围内，并返回规范化的路径
function normalizeAndValidatePath(path) {
  // 如果是别名，转换为实际路径
  const baseConfig = ALLOWED_PATHS.find(p => p.alias === path)
  if (baseConfig) {
    return {
      fullPath: normalize(baseConfig.path),
      currentPath: path,
      isAllowed: true
    }
  }

  // 处理相对路径
  const pathParts = path.split('/')
  const basePath = pathParts[0]
  const subConfig = ALLOWED_PATHS.find(p => p.alias === basePath)
  
  if (subConfig) {
    const subPath = pathParts.slice(1).join('/')
    const fullPath = normalize(join(subConfig.path, subPath))
    return {
      fullPath,
      currentPath: path,
      isAllowed: true
    }
  }

  // 如果路径不是以允许的路径开头，则拒绝访问
  const fullPath = normalize(join(__dirname, path))
  const isAllowed = ALLOWED_PATHS.some(p => 
    fullPath.startsWith(normalize(p.path))
  )

  return {
    fullPath,
    currentPath: path,
    isAllowed
  }
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: function (req, file, cb) {
    // 保持原始文件名，不做任何修改
    cb(null, file.originalname)
  }
})

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 确保文件名使用UTF-8编码
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, true)
  }
})

// 读取 cookie
let cookie = ''
try {
  cookie = fs.readFileSync('cookie.txt', 'utf8')
} catch (err) {
  console.error('读取 cookie 失败:', err)
}

// 初始化 AI Studio
let aiStudio = null
async function initAIStudio() {
  if (!cookie) {
    throw new Error('未找到 cookie.txt 文件')
  }
  aiStudio = await (new AI_Studio(cookie)).initialize()
}

async function createServer() {
  const app = express()
  
  // 添加请求日志中间件
  app.use(requestLogger)
  
  // 创建 Vite 服务器
  const startTime = Date.now()
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  })
  logPerformance('Vite服务器创建', startTime)
  logger.info('Vite 服务器已创建')

  // 初始化 AI Studio
  try {
    if (!aiStudio) {
      logger.info('正在初始化 AI Studio...')
      const initStartTime = Date.now()
      await initAIStudio()
      logPerformance('AI Studio初始化', initStartTime)
      logger.info('AI Studio 初始化成功')
    }
    // 获取数据集列表
    const listStartTime = Date.now()
    const list_resp = await aiStudio.getPrivateList("", 1, 1)
    logPerformance('获取数据集列表', listStartTime)
    if (list_resp && list_resp.body && list_resp.body.result) {
      logger.info('数据集统计', {
        totalCount: list_resp.body.result.totalCount
      })
    }
  } catch (error) {
    logError('获取数据集统计失败', error)
  }

  // 定期记录系统资源使用情况
  setInterval(logSystemResources, 5 * 60 * 1000) // 每5分钟记录一次

  // 使用 vite 的中间件
  app.use(vite.middlewares)
  app.use(express.json())
  
  // 处理文件列表 API
  app.get('/api/files', async (req, res) => {
    try {
      const { path = '.' } = req.query
      logger.debug('获取文件列表', { path })
      
      const { fullPath, currentPath, isAllowed } = normalizeAndValidatePath(path)
      
      if (!isAllowed) {
        logSecurity('非法路径访问', { path, fullPath })
        return res.status(403).json({ error: '访问被拒绝：路径超出允许范围' })
      }

      const items = await readdir(fullPath)
      logger.debug('文件列表获取成功', {
        path,
        itemCount: items.length
      })
      const fileList = await Promise.all(
        items.map(async (name) => {
          const itemPath = join(fullPath, name)
          const stats = await stat(itemPath)
          return {
            name,
            type: stats.isDirectory() ? '文件夹' : '文件',
            size: stats.size
          }
        })
      )

      res.json({
        currentPath,
        parentPath: currentPath === '.' ? null : currentPath.split('/').slice(0, -1).join('/') || '.',
        files: fileList
      })
    } catch (error) {
      logError('获取文件列表失败', error)
      res.status(500).json({ error: '获取文件列表失败' })
    }
  })

  // 处理更新数据集
  app.put('/api/datasets/:datasetId', async (req, res) => {
    try {
      const { datasetId } = req.params
      logger.info('开始更新数据集', { datasetId })
      
      if (!aiStudio) {
        logger.info('AI Studio 未初始化，正在初始化...')
        await initAIStudio()
      }

      const {
        datasetName,
        datasetAbs,
        tags,
        fileIds,
        fileAbsList,
        ispublic
      } = req.body

      logBusiness('业务操作', { operation: 'update', details: req.body })

      // Validate datasetId
      if (!datasetId) {
        return res.status(400).json({
          success: false,
          error: 'Dataset ID is required'
        })
      }

      // Validate other parameters
      try {
        // Note: validateDatasetParams doesn't directly support ispublic,
        // but it validates the core parameters.
        // We'll handle ispublic separately or assume a default.
        validateDatasetParams({ datasetName, datasetAbs, tags, fileIds })
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: error.message
        })
      }

      const datasetContent = datasetAbs || '' // Use datasetAbs for datasetContent
      const finalIspublic = typeof ispublic === 'number' ? ispublic : 0 // Default to 0 (private)

      // Call AI Studio saveEdit
      const editResp = await aiStudio.saveEdit(
        datasetId,
        datasetName,
        datasetAbs,
        datasetContent,
        tags || [],
        fileIds,
        fileAbsList || [],
        finalIspublic
      )

      if (!editResp || !editResp.body) {
        throw new Error('更新数据集失败: 服务器响应为空')
      }

      if (editResp.body.error_code) {
        // Log the detailed error from AI Studio
        console.error('AI Studio Error:', JSON.stringify(editResp.body, null, 2));
        throw new Error(`更新数据集失败: ${editResp.body.error_msg || '未知AI Studio错误'}`)
      }
      
      // Assuming a successful response structure, similar to create.
      // Adjust if AI Studio's saveEdit response is different.
      // For example, it might return the updated dataset details or just a success status.
      if (editResp.body.result) { // Or any other success indicator from AI Studio
        res.json({
          success: true,
          message: '数据集更新成功',
          result: editResp.body.result // Send back AI Studio's result
        })
      } else {
         // If no specific result but also no error_code, assume success but log for review
        console.warn('更新数据集响应未包含明确的result, 但无错误码:', JSON.stringify(editResp.body, null, 2));
        res.json({
          success: true,
          message: '数据集更新操作已提交' 
        });
      }

    } catch (error) {
      logError('更新数据集失败', error)
      res.status(500).json({
        success: false,
        error: error.message || '更新数据集失败'
      })
    }
  })

  // 处理服务器文件上传到数据集
  app.post('/api/upload-to-dataset', async (req, res) => {
    const uploadStartTime = Date.now()
    try {
      const { filePath, fileName, folderPath, currentPath, selectedBasePath } = req.body
      logger.info('开始上传文件到数据集', {
        fileName,
        folderPath,
        currentPath,
        selectedBasePath,
        timestamp: new Date().toISOString()
      })

      if (!filePath || !fileName) {
        throw new Error('缺少必要参数')
      }

      // 获取文件大小
      let fullPath
      // 如果是绝对路径（以 D:/ 或 D:\ 开头），直接使用
      if (filePath.startsWith('D:/') || filePath.startsWith('D:\\')) {
        fullPath = normalize(filePath)
      } else {
        // 构建完整路径
        let targetPath = filePath
        // 如果当前路径不是根目录，且文件路径不包含当前路径，则添加当前路径
        if (currentPath && currentPath !== '.' && !filePath.startsWith(currentPath)) {
          targetPath = `${currentPath}/${filePath}`
        }

        const result = normalizeAndValidatePath(targetPath)
        if (!result.isAllowed) {
          console.warn(`文件上传被拒绝: ${targetPath} 超出允许范围`)
          return res.status(403).json({ error: '访问被拒绝：路径超出允许范围' })
        }
        fullPath = result.fullPath
      }

      // 检查文件是否存在
      try {
        await stat(fullPath)
      } catch (error) {
        console.error(`文件不存在: ${fullPath}`, error)
        return res.status(404).json({ error: `文件不存在: ${fullPath}` })
      }

      const stats = await stat(fullPath)
      const fileSize = stats.size
      console.log(`文件信息: ${fileName}, 大小: ${Math.round(fileSize / 1024 / 1024)}MB`)

      if (stats.isDirectory()) {
        console.log(`开始上传目录: ${fullPath}`)
        // Helper function to recursively upload files in a directory
        async function uploadDirectory(currentDir, baseDatasetPath) {
          const results = []
          const items = await readdir(currentDir)
          console.log(`目录 ${currentDir} 中包含 ${items.length} 个项目`)

          for (const item of items) {
            const itemPath = join(currentDir, item)
            const itemStats = await stat(itemPath)
            const relativePath = relative(fullPath, itemPath)
            const fileAbs = baseDatasetPath ? join(baseDatasetPath, relativePath) : relativePath
            const normalizedFileAbs = fileAbs.split('\\').join('/')

            if (itemStats.isDirectory()) {
              console.log(`处理子目录: ${itemPath}`)
              results.push(...await uploadDirectory(itemPath, baseDatasetPath))
            } else {
              console.log(`开始上传文件: ${itemPath}`)
              const fileUploadStartTime = Date.now()
              const { client, fileKey, bucketName } = await aiStudio.bosClient(false)
              const uploadTask = client.putSuperObject({
                bucketName,
                objectName: fileKey,
                data: itemPath,
                partConcurrency: 2
              })
              await uploadTask.start()
              while (!uploadTask.isCompleted()) {
                await new Promise(resolve => setTimeout(resolve, 100))
              }
              logPerformance(`文件上传 ${item}`, fileUploadStartTime)

              console.log(`文件 ${item} 上传完成，开始添加到数据集`)
              const addFileStartTime = Date.now()
              const addFileResp = await aiStudio.addFile(item, fileKey, false)
              logPerformance(`添加到数据集 ${item}`, addFileStartTime)

              if (addFileResp && addFileResp.body && addFileResp.body.result && addFileResp.body.result.fileId) {
                console.log(`文件 ${item} 成功添加到数据集，fileId: ${addFileResp.body.result.fileId}`)
                results.push({
                  success: true,
                  fileId: addFileResp.body.result.fileId,
                  fileAbs: normalizedFileAbs,
                  fileName: item
                })
                await new Promise(resolve => setTimeout(resolve, 500))
              } else {
                console.error(`添加到数据集失败: ${item}`, addFileResp.body?.error_msg || '未知错误')
                results.push({
                  success: false,
                  fileName: item,
                  fileAbs: normalizedFileAbs,
                  error: `添加到数据集失败: ${addFileResp.body?.error_msg || '未知错误'}`
                })
              }
            }
          }
          return results
        }

        // Start directory upload
        const uploadResults = await uploadDirectory(fullPath, folderPath)
        const validResults = uploadResults.filter(r => r)
        const allSuccessful = validResults.every(r => r.success)
        
        if (validResults.length === 0) {
          console.warn(`目录 ${fullPath} 中没有可上传的文件`)
          return res.status(404).json({ success: false, error: '目录中没有可上传的文件' })
        }

        logPerformance('目录上传完成', uploadStartTime)
        console.log(`目录上传完成，成功: ${validResults.filter(r => r.success).length}/${validResults.length} 个文件`)

        res.json({
          success: allSuccessful,
          message: allSuccessful ? '文件夹上传成功' : '文件夹部分上传成功',
          results: validResults
        })

      } else {
        console.log(`开始上传单个文件: ${fullPath}`)
        const { client, fileKey, bucketName } = await aiStudio.bosClient(false)

        // 上传文件到 BOS
        const uploadTask = client.putSuperObject({
          bucketName,
          objectName: fileKey,
          data: fullPath,
          partConcurrency: 2
        })

        // 启动上传
        await uploadTask.start()
        console.log(`文件 ${fileName} 开始上传到 BOS`)

        // 等待上传完成
        while (!uploadTask.isCompleted()) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        console.log(`文件 ${fileName} 上传到 BOS 完成`)

        // 添加到数据集
        console.log(`开始将文件 ${fileName} 添加到数据集`)
        const addFileStartTime = Date.now()
        const addFileResp = await aiStudio.addFile(fileName, fileKey, false)
        logPerformance(`添加到数据集 ${fileName}`, addFileStartTime)

        if (!addFileResp || !addFileResp.body || !addFileResp.body.result || !addFileResp.body.result.fileId) {
          throw new Error('添加到数据集失败: 响应格式错误')
        }
        const fileId = addFileResp.body.result.fileId
        console.log(`文件 ${fileName} 成功添加到数据集，fileId: ${fileId}`)

        // 等待一段时间确保文件处理完成
        await new Promise(resolve => setTimeout(resolve, 2000))

        logPerformance('文件上传完成', uploadStartTime)
        res.json({
          success: true,
          fileId,
          fileAbs: folderPath ? `${folderPath}/${fileName}` : fileName
        })
      }
    } catch (error) {
      logError('上传到数据集失败', error)
      res.status(500).json({ 
        success: false, 
        error: error.message || '上传到数据集失败'
      })
    }
  })

  // 处理本地文件上传到数据集
  app.post('/api/upload-local-to-dataset', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        console.warn('未收到上传文件')
        throw new Error('未收到文件')
      }

      const { originalname, path: tempPath, size: fileSize } = req.file
      console.log('收到本地文件上传:', {
        fileName: originalname,
        fileSize,
        tempPath
      })
      // 确保文件名使用UTF-8编码
      const decodedFileName = Buffer.from(originalname, 'latin1').toString('utf8')
      const datasetName = req.body.datasetName || decodedFileName
      const datasetAbs = req.body.datasetAbs || '通过文件选择器上传的文件'
      let tags = []
      try {
        tags = req.body.tags ? JSON.parse(req.body.tags) : []
      } catch (e) {
        console.warn('解析标签失败:', e)
      }

      // 验证参数
      // Note: validateDatasetParams might need adjustment if it's too strict for local uploads
      // where fileId might not be immediately known or relevant before actual upload.
      // For now, assuming it's adaptable or focusing on the server-side upload logic.
      try {
        validateDatasetParams({
          fileName: decodedFileName, // Use decoded name for validation
          datasetName,
          datasetAbs,
          tags,
          fileIds: [1], // Placeholder, as file isn't in AI Studio yet
          fileSize
        })
      } catch (error) {
        fs.unlinkSync(tempPath)
        return res.status(400).json({
          success: false,
          error: error.message
        })
      }


      // 获取 BOS 客户端
      const { client, fileKey, bucketName } = await aiStudio.bosClient(false)

      // 上传文件到 BOS
      const uploadTask = client.putSuperObject({
        bucketName,
        objectName: fileKey,
        data: tempPath,
        partConcurrency: 2,
        onProgress: (options) => {
          const { progress, speed } = options
          console.log('上传进度:', progress, '速度:', speed)
        }
      })

      // 启动上传
      const tasks = uploadTask.start()
      console.log('切分任务:', tasks)

      // 等待上传完成
      while (!uploadTask.isCompleted()) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 清理临时文件
      fs.unlinkSync(tempPath)

      // 添加到数据集
      const addFileResp = await aiStudio.addFile(decodedFileName, fileKey, false) // Use decoded name
      if (!addFileResp || !addFileResp.body || !addFileResp.body.result || !addFileResp.body.result.fileId) {
        throw new Error(`添加到数据集失败: ${addFileResp.body?.error_msg || '响应格式错误'}`)
      }
      const fileId = addFileResp.body.result.fileId

      res.json({
        success: true,
        fileId,
        // For local uploads, fileAbs is typically just the filename unless other context is provided.
        // This matches the existing behavior implicitly.
        fileAbs: decodedFileName 
      })
    } catch (error) {
      logError('上传到数据集失败', error)
      // 确保清理临时文件
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path)
        } catch (e) {
          console.error('清理临时文件失败:', e)
        }
      }
      res.status(500).json({ 
        success: false, 
        error: error.message || '上传到数据集失败' 
      })
    }
  })

  // 创建数据集
  app.post('/api/create-dataset', async (req, res) => {
    try {
      console.log('开始创建新数据集')
      
      if (!aiStudio) {
        console.log('AI Studio 未初始化，正在初始化...')
        await initAIStudio()
      }

      // 检查数据集数量是否超过限制
      const list_resp = await aiStudio.getPrivateList("", 1, 1)
      if (list_resp && list_resp.body && list_resp.body.result) {
        const currentCount = list_resp.body.result.totalCount
        console.log(`当前数据集数量: ${currentCount}/${DATASET_CONSTRAINTS.MAX_DATASETS_COUNT}`)
        if (currentCount >= DATASET_CONSTRAINTS.MAX_DATASETS_COUNT) {
          return res.status(400).json({
            success: false,
            error: `创建失败：已达到最大数据集数量限制（${DATASET_CONSTRAINTS.MAX_DATASETS_COUNT}个）`
          })
        }
      }

      const { datasetName, datasetAbs, tags, fileIds, fileAbsList } = req.body
      console.log('创建数据集请求:', {
        datasetName,
        datasetAbs,
        tags,
        fileIds,
        fileAbsList
      })

      // 验证参数
      try {
        // Ensure fileAbsList elements also meet constraints if they are new files.
        // This part might need more robust validation depending on how fileAbsList is used.
        validateDatasetParams({ datasetName, datasetAbs, tags, fileIds, fileAbsList: fileAbsList || [] })
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: error.message
        })
      }
      
      // Ensure fileAbsList has forward slashes, as this is often a point of error if not standardized
      const normalizedFileAbsList = (fileAbsList || []).map(fab => fab.split('\\').join('/'));


      // 创建数据集
      const createResp = await aiStudio.create(
        datasetName,  // 数据集名称
        datasetAbs || '',  // 数据集描述
        datasetAbs || '',  // 数据集内容
        tags || [],  // 标签
        fileIds,  // 文件ID列表
        normalizedFileAbsList,  // 文件描述列表，包含文件的完整相对路径
        0  // 是否公开
      )

      if (!createResp || !createResp.body) {
        throw new Error('创建数据集失败: 服务器响应为空')
      }

      if (createResp.body.error_code) {
        throw new Error(`创建数据集失败: ${createResp.body.error_msg || '未知错误'}`)
      }

      if (!createResp.body.result || !createResp.body.result.datasetId) {
        console.error('创建数据集响应:', JSON.stringify(createResp.body, null, 2))
        throw new Error('创建数据集失败: 响应中未包含数据集ID')
      }

      res.json({
        success: true,
        datasetId: createResp.body.result.datasetId
      })
    } catch (error) {
      logError('创建数据集失败', error)
      res.status(500).json({
        success: false,
        error: error.message || '创建数据集失败'
      })
    }
  })

  // 处理URL抓取上传到数据集
  app.post('/api/fetch-to-dataset', async (req, res) => {
    try {
      const { url, fileName, referer, userAgent, datasetName, datasetAbs, tags } = req.body
      console.log('开始URL抓取上传:', {
        url,
        fileName,
        datasetName,
        tagsCount: tags?.length
      })

      if (!url || !fileName) {
        throw new Error('缺少必要参数')
      }

      // 验证参数
      try {
        validateDatasetParams({
          fileName,
          datasetName: datasetName || fileName,
          datasetAbs: datasetAbs || '通过URL抓取上传的文件',
          tags: tags || [],
          fileIds: [1], // 假设只有一个文件
          fileSize: 0 // 文件大小未知
        })
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: error.message
        })
      }

      // 获取 BOS 客户端
      const { client, fileKey, bucketName } = await aiStudio.bosClient(false)

      // 设置抓取选项
      const options = {
        'x-bce-fetch-source': url
      }
      if (referer) {
        options['x-bce-fetch-referer'] = referer
      }
      if (userAgent) {
        options['x-bce-fetch-user-agent'] = userAgent
      }

      console.log('开始抓取文件:', {
        bucketName,
        fileKey,
        url,
        options
      })

      // 抓取并上传文件到 BOS
      try {
        // 执行抓取，如果执行成功（不抛出异常）则表示抓取任务已提交
        await client.fetchObject(bucketName, fileKey, options)
        console.log('抓取任务已提交，等待完成...')

        // 等待一段时间，确保文件已经抓取完成
        await new Promise(resolve => setTimeout(resolve, 5000))

        // 添加到数据集
        console.log('开始添加到数据集:', {
          fileName,
          fileKey
        })

        const addFileResp = await aiStudio.addFile(fileName, fileKey, false)
        console.log('添加到数据集结果:', addFileResp)

        if (!addFileResp || !addFileResp.body || !addFileResp.body.result || !addFileResp.body.result.fileId) {
          throw new Error('添加到数据集失败: 响应格式错误')
        }

        const fileId = addFileResp.body.result.fileId

        res.json({
          success: true,
          fileId,
          message: '文件抓取并上传成功'
        })
      } catch (error) {
        console.error('抓取或上传过程出错:', error)
        throw new Error(`文件抓取或上传失败: ${error.message}`)
      }
    } catch (error) {
      logError('URL抓取上传失败', error)
      res.status(500).json({ 
        success: false, 
        error: error.message || 'URL抓取上传失败' 
      })
    }
  })

  // 获取BOS客户端凭证
  app.get('/api/get-bos-client', async (req, res) => {
    try {
      if (!aiStudio) {
        await initAIStudio()
      }

      // 获取BOS客户端配置
      const { endpoint, bucketName } = await aiStudio.bosClient(false)

      // 只返回必要的配置信息，不返回凭证
      res.json({
        endpoint,
        bucketName
      })
    } catch (error) {
      logError('获取BOS客户端配置失败', error)
      res.status(500).json({
        success: false,
        error: error.message || '获取BOS客户端配置失败'
      })
    }
  })

  // 添加文件到数据集
  app.post('/api/add-file-to-dataset', async (req, res) => {
    try {
      if (!aiStudio) {
        await initAIStudio()
      }

      const { fileName, fileKey, bucketName } = req.body
      if (!fileName || !fileKey || !bucketName) {
        throw new Error('缺少必要参数')
      }

      // 添加到数据集
      const addFileResp = await aiStudio.addFile(fileName, fileKey, false)
      if (!addFileResp || !addFileResp.body || !addFileResp.body.result || !addFileResp.body.result.fileId) {
        throw new Error('添加到数据集失败')
      }

      res.json({
        success: true,
        fileId: addFileResp.body.result.fileId
      })
    } catch (error) {
      logError('添加到数据集失败', error)
      res.status(500).json({
        success: false,
        error: error.message || '添加到数据集失败'
      })
    }
  })

  // 添加数据集列表API
  app.get('/api/datasets/private', async (req, res) => {
    try {
      if (!aiStudio) {
        await initAIStudio()
      }
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const list_resp = await aiStudio.getPrivateList("", page, pageSize);
      res.json(list_resp.body);
    } catch (error) {
      logError('获取数据集列表失败', error)
      res.status(500).json({ error: '获取数据集列表失败' });
    }
  });

  // 添加数据集详情API
  app.get('/api/datasets/:datasetId/detail', async (req, res) => {
    try {
      if (!aiStudio) {
        await initAIStudio()
      }
      const { datasetId } = req.params;
      const detail_resp = await aiStudio.fetchDetail(datasetId);
      res.json(detail_resp.body);
    } catch (error) {
      logError('获取数据集详情失败', error)
      res.status(500).json({ error: '获取数据集详情失败' });
    }
  });

  // 添加获取数据集文件URL的API
  app.get('/api/datasets/:datasetId/files/:fileId/url', async (req, res) => {
    try {
      if (!aiStudio) {
        await initAIStudio()
      }
      const { datasetId, fileId } = req.params;
      const url_resp = await aiStudio.datasetFileDownload(datasetId, parseInt(fileId));
      // 只返回 bosUrl 字符串，失败时返回空字符串
      const bosUrl = url_resp.body?.result?.bosUrl || '';
      res.send(bosUrl);
    } catch (error) {
      logError('获取文件URL失败', error)
      res.send('');
    }
  });

  // 添加获取数据集约束的API
  app.get('/api/dataset-constraints', (req, res) => {
    res.json({
      file: {
        maxFileNameLength: DATASET_CONSTRAINTS.MAX_FILE_NAME_LENGTH,
        maxFileAbsLength: DATASET_CONSTRAINTS.MAX_FILE_ABS_LENGTH,
        maxFilesPerDataset: DATASET_CONSTRAINTS.MAX_FILES_PER_DATASET,
        maxDatasetSizeGB: DATASET_CONSTRAINTS.MAX_DATASET_SIZE_GB
      },
      dataset: {
        maxNameLength: DATASET_CONSTRAINTS.MAX_DATASET_NAME_LENGTH,
        maxNameDisplayLength: DATASET_CONSTRAINTS.MAX_DATASET_NAME_DISPLAY_LENGTH,
        maxAbsLength: DATASET_CONSTRAINTS.MAX_DATASET_ABS_LENGTH,
        maxCount: DATASET_CONSTRAINTS.MAX_DATASETS_COUNT
      },
      tag: {
        maxLength: DATASET_CONSTRAINTS.MAX_TAG_LENGTH,
        maxLengthAll: DATASET_CONSTRAINTS.MAX_TAG_LENGTH_ALL,
        maxCount: DATASET_CONSTRAINTS.MAX_TAGS_COUNT
      }
    })
  })

  // 添加获取当前数据集数量的API
  app.get('/api/datasets/count', async (req, res) => {
    try {
      if (!aiStudio) {
        await initAIStudio()
      }
      const list_resp = await aiStudio.getPrivateList("", 1, 1)
      if (list_resp && list_resp.body && list_resp.body.result) {
        res.json(list_resp.body.result.totalCount)
      } else {
        throw new Error('获取数据集数量失败')
      }
    } catch (error) {
      logError('获取数据集数量失败', error)
      res.sendStatus(500)
    }
  })

  // 处理删除数据集
  app.delete('/api/datasets/:datasetId', async (req, res) => {
    try {
      const { datasetId } = req.params
      console.log(`开始删除数据集 ${datasetId}`)
      
      if (!aiStudio) {
        console.log('AI Studio 未初始化，正在初始化...')
        await initAIStudio()
      }

      if (!datasetId) {
        throw new Error('缺少数据集ID')
      }

      // 检查数据集是否被使用
      const usedResponse = await aiStudio.getDatasetUsed(datasetId)
      if (!usedResponse.body) {
        throw new Error('检查数据集使用状态失败: 响应为空')
      }

      if (usedResponse.body.errorCode !== 0) {
        throw new Error(`检查数据集使用状态失败: ${usedResponse.body.errorMsg || '未知错误'}`)
      }

      if (usedResponse.body.result === true) {
        throw new Error('数据集正在被使用，无法删除')
      }

      // 删除数据集
      const response = await aiStudio.del(datasetId)
      if (!response.body) {
        throw new Error('删除数据集失败: 响应为空')
      }

      if (response.body.errorCode !== 0) {
        throw new Error(`删除数据集失败: ${response.body.errorMsg || '未知错误'}`)
      }

      if (response.body.result !== '删除成功') {
        throw new Error('删除数据集失败: 操作未成功')
      }

      res.json({ success: true })
    } catch (error) {
      console.error('删除数据集失败:', error)
      res.status(500).json({ 
        success: false, 
        error: error.message || '删除数据集失败' 
      })
    }
  })

  // 删除数据集中的文件
  app.delete('/api/datasets/:datasetId/files/:fileId', async (req, res) => {
    try {
      const { datasetId, fileId } = req.params;
      console.log(`开始从数据集 ${datasetId} 中删除文件 ${fileId}`);

      if (!datasetId || !fileId) {
        return res.status(400).json({ success: false, error: '数据集ID和文件ID都是必需的' });
      }

      // 获取数据集详情
      const datasetDetail = await aiStudio.fetchDetail(datasetId);
      if (!datasetDetail || !datasetDetail.body || !datasetDetail.body.result) {
        console.error('数据集详情获取失败:', {
          hasDetail: !!datasetDetail,
          hasBody: !!(datasetDetail && datasetDetail.body),
          hasResult: !!(datasetDetail && datasetDetail.body && datasetDetail.body.result)
        });
        return res.status(404).json({ success: false, error: '数据集不存在' });
      }

      const dataset = datasetDetail.body.result;
      const fileList = dataset.fileList || [];
      
      // 找到要删除的文件
      const fileIndex = fileList.findIndex(f => f.fileId === parseInt(fileId));
      if (fileIndex === -1) {
        return res.status(404).json({ success: false, error: '文件不存在于数据集中' });
      }

      // 从fileList中移除文件
      fileList.splice(fileIndex, 1);

      // 准备更新数据集的数据
      const updateData = {
        datasetId,
        datasetName: dataset.datasetName,
        datasetAbs: dataset.datasetAbs || dataset.datasetName || '数据集描述',
        datasetContent: dataset.datasetContent || dataset.datasetAbs || dataset.datasetName || '数据集内容',
        tags: dataset.tags || [],
        fileIds: fileList.map(f => f.fileId),
        fileAbsList: fileList.map(f => f.fileAbs),
        ispublic: dataset.public
      };

      // 调用saveEdit更新数据集
      const result = await aiStudio.saveEdit(
        updateData.datasetId,
        updateData.datasetName,
        updateData.datasetAbs,
        updateData.datasetContent,
        updateData.tags,
        updateData.fileIds,
        updateData.fileAbsList,
        updateData.ispublic
      );

      if (!result || !result.body || result.body.error_code) {
        console.error('更新数据集失败:', {
          errorCode: result?.body?.error_code,
          errorMsg: result?.body?.error_msg
        });
        throw new Error(result?.body?.error_msg || '更新数据集失败');
      }

      res.json({ success: true, message: '文件已成功从数据集中移除' });
    } catch (error) {
      console.error('删除文件失败:', error.message);
      res.status(500).json({ success: false, error: error.message || '删除文件时发生错误' });
    }
  });

  // 处理所有其他请求
  app.use('*', async (req, res, next) => {
    // 如果是 API 请求，跳过
    if (req.originalUrl.startsWith('/api/')) {
      return next()
    }

    try {
      // 读取 index.html
      const template = await readFile(join(__dirname, 'index.html'), 'utf-8')
      
      // 使用 Vite 转换 HTML
      const html = await vite.transformIndexHtml(req.originalUrl, template)
      
      // 发送处理后的 HTML
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      // 如果出错，让 Vite 处理
      vite.ssrFixStacktrace(e)
      next(e)
    }
  })

  // 优化错误处理
  app.use((err, req, res, next) => {
    logger.error('服务器错误', {
      error: {
        message: err.message,
        stack: err.stack
      },
      request: {
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query
      },
      timestamp: new Date().toISOString()
    })
    // 记录系统资源状态
    logSystemResources()
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
    })
  })

  const PORT = 3000
  app.listen(PORT, () => {
    logger.info('服务器启动', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    })
    // 记录初始系统资源状态
    logSystemResources()
  })
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', {
    error: {
      message: error.message,
      stack: error.stack
    },
    timestamp: new Date().toISOString()
  })
  // 记录系统资源状态
  logSystemResources()
})

// 处理未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝', {
    reason,
    promise,
    timestamp: new Date().toISOString()
  })
  // 记录系统资源状态
  logSystemResources()
})

createServer() 