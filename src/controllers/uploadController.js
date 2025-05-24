import fs from 'fs';
import { stat, readdir } from 'fs/promises';
import { join, relative, normalize } from 'path';
import { getAIStudioInstance, initializeAIStudio } from '../services/aiStudioService.js';
import { normalizeAndValidatePath } from '../utils/serverUtils.js';
import { validateDatasetParams } from '../api/aistudio.js';
import { logger, logError, logPerformance, logBusiness } from '../config/logger.js'; 
import { sendProgress, closeConnection } from '../utils/sseManager.js'; 

async function getInitializedAIStudio(requestId) {
  // logger.debug('Attempting to get AI Studio instance in uploadController.', { requestId });
  try {
    const instance = await getAIStudioInstance();
    // logger.debug('Successfully retrieved AI Studio instance in uploadController.', { requestId });
    return instance;
  } catch (error) {
    logger.warn('AI Studio instance was not ready in uploadController, attempting re-initialization.', { requestId, error: error.message });
    try {
        const newInstance = await initializeAIStudio();
        logger.info('Re-initialization of AI Studio successful in uploadController.', { requestId });
        return newInstance;
    } catch (initError) {
        logger.error('Failed to re-initialize AI Studio in uploadController.', { requestId, error: initError.message, stack: initError.stack });
        throw initError; 
    }
  }
}

export const uploadToServerDataset = async (req, res) => {
  const uploadStartTime = Date.now();
  const { filePath, fileName, folderPath, currentPath, uploadId } = req.body; 
  const serverDirname = req.app.locals.__dirname;
  const requestId = req.id; // Assuming req.id is populated by requestLogger middleware

  logger.info('Starting uploadToServerDataset.', { requestId, uploadId, filePath, fileName, folderPath, currentPath });
  logBusiness('Upload Server File/Folder', { requestId, uploadId, fileName, targetFolder: folderPath });


  if (!uploadId) {
    logger.warn('uploadToServerDataset: uploadId is missing from request body.', { requestId });
    return res.status(400).json({ success: false, error: 'uploadId is required for progress reporting.' });
  }

  try {
    const aiStudio = await getInitializedAIStudio(requestId);
    logger.info('Initiating server file/folder processing.', { 
      requestId, 
      fileName,
      folderPath,
      currentPath,
      uploadId,
    });

    if (!filePath || !fileName) {
      logger.warn('uploadToServerDataset: Missing required parameters filePath or fileName.', { requestId, uploadId, filePath, fileName });
      sendProgress(uploadId, { status: 'failed', message: 'Missing required parameters.', error: 'Missing parameters' });
      closeConnection(uploadId);
      return res.status(400).json({ success: false, error: '缺少必要参数: filePath and fileName are required.' });
    }
    
    let fullPathToProcess;
    if (filePath.startsWith('D:/') || filePath.startsWith('D:\\') || filePath.startsWith('/')) { 
        fullPathToProcess = normalize(filePath);
    } else {
        let targetPath = filePath;
        if (currentPath && currentPath !== '.' && !filePath.startsWith(currentPath)) {
            targetPath = join(currentPath, filePath);
        }
        const validationResult = normalizeAndValidatePath(targetPath, serverDirname);
        if (!validationResult.isAllowed) {
            logger.warn(`uploadToServerDataset: Path validation failed - access denied.`, { requestId, uploadId, targetPath, validationResult });
            sendProgress(uploadId, { status: 'failed', message: 'Access denied to path.', error: 'Access denied' });
            closeConnection(uploadId);
            return res.status(403).json({ error: '访问被拒绝：路径超出允许范围' });
        }
        fullPathToProcess = validationResult.fullPath;
    }
    logger.debug('uploadToServerDataset: Path to process determined.', { requestId, uploadId, fullPathToProcess });

    try {
      await stat(fullPathToProcess);
    } catch (error) {
      logger.error(`uploadToServerDataset: File/Directory not found at path.`, { requestId, uploadId, fullPathToProcess, error: error.message, stack: error.stack });
      sendProgress(uploadId, { status: 'failed', message: 'File or directory not found.', error: `File not found: ${fullPathToProcess}` });
      closeConnection(uploadId);
      return res.status(404).json({ error: `文件不存在: ${fullPathToProcess}` });
    }

    const stats = await stat(fullPathToProcess);
    logger.info(`uploadToServerDataset: Starting upload for ${stats.isDirectory() ? 'directory' : 'file'}.`, { requestId, uploadId, name: fileName, path: fullPathToProcess, size: stats.size });

    if (stats.isDirectory()) {
      logger.info(`uploadToServerDataset: Processing directory upload.`, { requestId, uploadId, directory: fullPathToProcess });
      sendProgress(uploadId, { status: 'processing_folder', message: `Starting folder upload: ${fileName}`, folderName: fileName, progress: 1 });
      
      async function uploadDirectory(currentDir, baseDatasetPath, parentUploadId, reqId) { // Added reqId
        const results = [];
        const items = await readdir(currentDir);
        logger.debug(`uploadDirectory: Reading directory contents.`, { requestId: reqId, parentUploadId, currentDir, itemCount: items.length });
        
        const sseDataForDirRead = { status: 'info', message: `Found ${items.length} items in ${currentDir}.` };
        logger.debug(`SSE Sent (Folder Status): uploadId=${parentUploadId}, data=${JSON.stringify(sseDataForDirRead)}`, { requestId: reqId });
        sendProgress(parentUploadId, sseDataForDirRead);

        for (const item of items) {
          const itemPath = join(currentDir, item);
          const itemStats = await stat(itemPath);
          const relativeItemPath = relative(fullPathToProcess, itemPath); 
          const fileAbs = baseDatasetPath ? join(baseDatasetPath, relativeItemPath) : relativeItemPath;
          const normalizedFileAbs = fileAbs.split('\\').join('/');

          if (itemStats.isDirectory()) {
            logger.debug(`uploadDirectory: Processing subdirectory.`, { requestId: reqId, parentUploadId, itemPath });
            const sseDataForSubdir = { status: 'processing_subdir', message: `Entering subdirectory: ${item}`, subDirectoryName: item };
            logger.debug(`SSE Sent (Folder Status): uploadId=${parentUploadId}, data=${JSON.stringify(sseDataForSubdir)}`, { requestId: reqId });
            sendProgress(parentUploadId, sseDataForSubdir);
            results.push(...await uploadDirectory(itemPath, normalizedFileAbs, parentUploadId, reqId)); // Pass reqId
          } else {
            try { // Wrap individual file processing in try...catch
              logger.info(`uploadDirectory: Starting individual file upload.`, { requestId: reqId, parentUploadId, itemPath, itemName: item });
              const sseDataForFileStart = { status: 'processing_file', message: `Starting upload for file: ${item}`, individualFileName: item, progress: 0 };
              logger.debug(`SSE Sent (Individual File): uploadId=${parentUploadId}, data=${JSON.stringify(sseDataForFileStart)}`, { requestId: reqId });
              sendProgress(parentUploadId, sseDataForFileStart);
              
              const fileUploadStartTime = Date.now();
              const { client, fileKey, bucketName } = await aiStudio.bosClient(false);
              logger.debug(`uploadDirectory: BOS client obtained for file.`, { requestId: reqId, parentUploadId, itemName: item });

              const sseDataForBosStart = { status: 'uploading_to_bos_started', message: `BOS: Uploading ${item}...`, individualFileName: item, progress: 10 };
              logger.debug(`SSE Sent (Individual File): uploadId=${parentUploadId}, data=${JSON.stringify(sseDataForBosStart)}`, { requestId: reqId });
              sendProgress(parentUploadId, sseDataForBosStart);
              const uploadTask = client.putSuperObject({
                bucketName,
                objectName: fileKey,
              data: itemPath,
              partConcurrency: 2,
              onProgress: (event) => {
                const bosSpecificProgress = 10 + (event.progress * 0.8); 
                logger.debug(`uploadDirectory: BOS onProgress event.`, { requestId: reqId, parentUploadId, itemName: item, bosProgress: event.progress, overallProgress: bosSpecificProgress, speed: event.speed });
                const sseDataForBosProgress = { 
                  status: 'uploading_to_bos', 
                  message: `BOS Upload: ${item} ${event.progress}%`,
                  individualFileName: item, 
                  progress: bosSpecificProgress,
                  loadedBytes: event.loaded,
                  totalBytes: event.total,
                  speed: event.speed 
                };
                logger.debug(`SSE Sent (Individual File): uploadId=${parentUploadId}, data=${JSON.stringify(sseDataForBosProgress)}`, { requestId: reqId });
                sendProgress(parentUploadId, sseDataForBosProgress);
              }
            });
            await uploadTask.start();
            while (!uploadTask.isCompleted()) {
              await new Promise(resolve => setTimeout(resolve, 200)); 
            }
            const sseDataForBosComplete = { status: 'uploading_to_bos_completed', message: `BOS: Finished ${item}.`, individualFileName: item, progress: 90 };
            logger.debug(`SSE Sent (Individual File): uploadId=${parentUploadId}, data=${JSON.stringify(sseDataForBosComplete)}`, { requestId: reqId });
            sendProgress(parentUploadId, sseDataForBosComplete);
            logPerformance(`BOS上传 - ${item}`, fileUploadStartTime); // Retained logPerformance
            logger.info(`uploadDirectory: BOS upload completed.`, { requestId: reqId, parentUploadId, itemName: item, fileKey });

            logger.debug(`Calling aiStudio.addFile for item: ${item}, fileKey: ${fileKey}`, { requestId: reqId });
            const addFileStartTime = Date.now();
            const addFileResp = await aiStudio.addFile(item, fileKey, false);
            logger.debug(`aiStudio.addFile response for ${item}: ${JSON.stringify(addFileResp.body)}`, { requestId: reqId });
            logPerformance(`AI Studio添加文件 - ${item}`, addFileStartTime); // Retained logPerformance
            logger.debug(`uploadDirectory: AI Studio addFile response.`, { requestId: reqId, parentUploadId, itemName: item, responseBody: addFileResp.body });


            if (addFileResp && addFileResp.body && addFileResp.body.result && addFileResp.body.result.fileId) {
              logger.info(`uploadDirectory: File registered with AI Studio.`, { requestId: reqId, parentUploadId, itemName: item, fileId: addFileResp.body.result.fileId });
              const sseDataForFileComplete = { status: 'file_completed', message: `Registered: ${item}`, individualFileName: item, fileId: addFileResp.body.result.fileId, fileAbs: normalizedFileAbs, progress: 100 };
              logger.debug(`SSE Sent (Individual File): uploadId=${parentUploadId}, data=${JSON.stringify(sseDataForFileComplete)}`, { requestId: reqId });
              sendProgress(parentUploadId, sseDataForFileComplete);
              results.push({
                success: true,
                fileId: addFileResp.body.result.fileId,
                fileAbs: normalizedFileAbs,
                fileName: item
              });
            } else {
              logger.error(`uploadDirectory: Failed to register file with AI Studio.`, { requestId: reqId, parentUploadId, itemName: item, error: addFileResp.body?.error_msg, responseBody: addFileResp.body });
              const sseDataForFileFail = { status: 'file_failed', message: `Register failed: ${item}`, individualFileName: item, error: addFileResp.body?.error_msg || 'Unknown error' };
              logger.debug(`SSE Sent (Individual File): uploadId=${parentUploadId}, data=${JSON.stringify(sseDataForFileFail)}`, { requestId: reqId });
              sendProgress(parentUploadId, sseDataForFileFail);
              results.push({
                success: false,
                fileName: item,
                fileAbs: normalizedFileAbs,
                error: `添加到AI Studio失败: ${addFileResp.body?.error_msg || '未知错误'}`
              });
            }
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (e) {
            logger.error(`Error processing file ${itemPath} in uploadDirectory: ${e.message}`, { itemName: item, itemPath, error: e, stack: e.stack, requestId: reqId });
            sendProgress(parentUploadId, { status: 'file_failed', message: `Error processing ${item}: ${e.message}`, individualFileName: item, error: e.message });
            results.push({ success: false, fileName: item, fileAbs: normalizedFileAbs, error: `Error processing ${item}: ${e.message}` });
          }
        }
        return results;
      }

      const uploadResults = await uploadDirectory(fullPathToProcess, folderPath, uploadId, requestId); // Pass requestId
      const validResults = uploadResults.filter(r => r);
      logger.info('uploadToServerDataset: Directory upload process completed.', { requestId, uploadId, resultsCount: validResults.length });
      
      if (validResults.length === 0) {
        logger.warn(`uploadToServerDataset: No files found in directory for upload.`, { requestId, uploadId, directory: fullPathToProcess });
        const sseDataForNoFiles = { status: 'failed', message: 'No files found in the directory to upload.', error: 'No files found in the directory to upload.' };
        logger.debug(`SSE Sent (Folder Status): uploadId=${uploadId}, data=${JSON.stringify(sseDataForNoFiles)}`, { requestId });
        sendProgress(uploadId, sseDataForNoFiles);
        closeConnection(uploadId);
        return res.status(404).json({ success: false, error: '目录中没有可上传的文件' });
      }

      const allSuccessful = validResults.every(r => r.success);
      logPerformance('完整目录上传', uploadStartTime); // Retained logPerformance
      logger.info(`uploadToServerDataset: Directory upload final status.`, { requestId, uploadId, allSuccessful, successfulCount: validResults.filter(r => r.success).length, totalProcessed: validResults.length });
      
      const sseDataForCompletion = { 
        status: allSuccessful ? 'completed_folder' : 'completed_folder_with_errors', 
        message: allSuccessful ? 'Folder upload completed successfully.' : 'Folder upload completed with some errors.',
        results: validResults 
      };
      logger.debug(`SSE Sent (Folder Status): uploadId=${uploadId}, data=${JSON.stringify(sseDataForCompletion)}`, { requestId });
      sendProgress(uploadId, sseDataForCompletion);
      closeConnection(uploadId);
      res.json({
        success: allSuccessful,
        message: allSuccessful ? '文件夹上传成功' : '文件夹部分上传成功',
        results: validResults
      });

    } else { // Single file upload
      logger.info(`uploadToServerDataset: Processing single file upload.`, { requestId, uploadId, filePath: fullPathToProcess });
      sendProgress(uploadId, { status: 'processing_server', message: 'File received by server, starting BOS upload.', progress: 5 });
      
      const { client, fileKey, bucketName } = await aiStudio.bosClient(false);
      logger.debug('uploadToServerDataset: BOS client obtained for single file.', { requestId, uploadId });
      
      sendProgress(uploadId, { status: 'uploading_to_bos_started', message: 'BOS: Uploading...', progress: 10 });
      const uploadTask = client.putSuperObject({
        bucketName,
        objectName: fileKey,
        data: fullPathToProcess,
        partConcurrency: 2,
        onProgress: (event) => {
            const bosSpecificProgress = 10 + (event.progress * 0.8); 
            logger.debug('uploadToServerDataset: BOS onProgress event for single file.', { requestId, uploadId, fileName, bosProgress: event.progress, overallProgress: bosSpecificProgress, speed: event.speed });
            sendProgress(uploadId, { 
                status: 'uploading_to_bos', 
                message: `BOS Upload: ${fileName} ${event.progress}%`,
                progress: bosSpecificProgress,
                loadedBytes: event.loaded,
                totalBytes: event.total,
                speed: event.speed
            });
        }
      });
      await uploadTask.start();
      while (!uploadTask.isCompleted()) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      sendProgress(uploadId, { status: 'uploading_to_bos_completed', message: 'BOS: Finished.', progress: 90 });
      logger.info(`uploadToServerDataset: Single file BOS upload completed.`, { requestId, uploadId, fileName, fileKey });

      logger.debug(`uploadToServerDataset: Registering single file with AI Studio.`, { requestId, uploadId, fileName, fileKey });
      const addFileStartTime = Date.now();
      const addFileResp = await aiStudio.addFile(fileName, fileKey, false);
      logPerformance(`AI Studio添加文件 - ${fileName}`, addFileStartTime); // Retained logPerformance
      logger.debug(`uploadToServerDataset: AI Studio addFile response for single file.`, { requestId, uploadId, responseBody: addFileResp.body });


      if (!addFileResp || !addFileResp.body || !addFileResp.body.result || !addFileResp.body.result.fileId) {
        logger.error('uploadToServerDataset: Failed to register single file with AI Studio.', { requestId, uploadId, fileName, error: addFileResp.body?.error_msg, responseBody: addFileResp.body });
        sendProgress(uploadId, { status: 'failed', message: 'Failed to add file to AI Studio.', error: addFileResp.body?.error_msg || '响应格式错误' });
        closeConnection(uploadId);
        throw new Error(`添加到AI Studio失败: ${addFileResp.body?.error_msg || '响应格式错误'}`);
      }
      const fileId = addFileResp.body.result.fileId;
      logger.info(`uploadToServerDataset: Single file registered with AI Studio.`, { requestId, uploadId, fileName, fileId });
      
      await new Promise(resolve => setTimeout(resolve, 500)); 
      
      sendProgress(uploadId, { 
        status: 'completed', 
        message: 'File upload completed successfully.', 
        fileId: fileId, 
        fileAbs: folderPath ? `${folderPath}/${fileName}` : fileName,
        progress: 100
      });
      closeConnection(uploadId);
      logPerformance('完整单文件上传', uploadStartTime); // Retained logPerformance
      logger.info('uploadToServerDataset: Single file upload operation completed successfully.', { requestId, uploadId, fileName, fileId });
      res.json({
        success: true,
        fileId,
        fileAbs: folderPath ? `${folderPath}/${fileName}` : fileName
      });
    }
  } catch (error) {
    logger.error('uploadToServerDataset: Unhandled error during upload.', { requestId, uploadId, error: error.message, stack: error.stack, path: req.path, body: req.body });
    sendProgress(uploadId, { status: 'failed', message: error.message || '上传文件到数据集失败', error: error.message });
    closeConnection(uploadId);
    res.status(500).json({ 
      success: false, 
      error: error.message || '上传文件到数据集失败'
    });
  }
};

export const uploadLocalToDataset = async (req, res) => {
  const { uploadId, datasetName: bodyDatasetName, datasetAbs: bodyDatasetAbs, tags: bodyTags } = req.body; 
  const requestId = req.id;

  logger.info('Starting uploadLocalToDataset.', { requestId, uploadId, originalFilename: req.file?.originalname });
  logBusiness('Upload Local File', { requestId, uploadId, originalFilename: req.file?.originalname, targetDatasetName: bodyDatasetName });

  if (!uploadId) {
    logger.warn('uploadLocalToDataset: uploadId is missing from request body.', { requestId });
    return res.status(400).json({ success: false, error: 'uploadId is required for progress reporting.' });
  }

  try {
    const aiStudio = await getInitializedAIStudio(requestId);
    if (!req.file) {
      logger.warn('uploadLocalToDataset: No file received.', { requestId, uploadId });
      sendProgress(uploadId, { status: 'failed', message: 'No file received by server.', error: 'No file received' });
      closeConnection(uploadId);
      return res.status(400).json({ success: false, error: '未收到文件' });
    }

    const { originalname, path: tempPath, size: fileSize } = req.file;
    const fileName = originalname; // Already UTF-8 from multer fileFilter in uploadRoutes.js

    logger.info('File received by server, starting processing.', { requestId, uploadId, fileName, tempPath, fileSize });
    sendProgress(uploadId, { status: 'processing_server', message: 'File received by server, preparing for BOS upload.', progress: 5 });

    const datasetName = bodyDatasetName || fileName;
    const datasetAbs = bodyDatasetAbs || '通过文件选择器上传的文件';
    let tags = [];
    try {
      tags = bodyTags ? JSON.parse(bodyTags) : [];
    } catch (e) {
      logger.warn('uploadLocalToDataset: Failed to parse tags.', { requestId, uploadId, tags: bodyTags, error: e.message });
    }

    try {
      validateDatasetParams({ fileName, datasetName, datasetAbs, tags, fileIds: [1], fileSize });
      logger.debug('uploadLocalToDataset: Parameters validated.', { requestId, uploadId, fileName });
    } catch (error) {
      logger.warn('uploadLocalToDataset: Parameter validation failed.', { requestId, uploadId, fileName, error: error.message });
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); 
      sendProgress(uploadId, { status: 'failed', message: `Validation error: ${error.message}`, error: error.message });
      closeConnection(uploadId);
      return res.status(400).json({ success: false, error: error.message });
    }

    const { client, fileKey, bucketName } = await aiStudio.bosClient(false);
    logger.debug('uploadLocalToDataset: BOS client obtained.', { requestId, uploadId, fileName });
    
    sendProgress(uploadId, { status: 'uploading_to_bos_started', message: 'BOS: Uploading...', progress: 10 });
    const uploadTask = client.putSuperObject({
      bucketName,
      objectName: fileKey,
      data: tempPath,
      partConcurrency: 2,
      onProgress: (event) => {
        const overallProgress = 5 + (event.progress * 0.85); 
        logger.debug('uploadLocalToDataset: BOS onProgress event.', { requestId, uploadId, fileName, bosProgress: event.progress, overallProgress, speed: event.speed });
        sendProgress(uploadId, {
            status: 'uploading_to_bos',
            message: `BOS Upload: ${fileName} ${event.progress}%`,
            progress: Math.min(overallProgress, 90), 
            loadedBytes: event.loaded,
            totalBytes: event.total,
            speed: event.speed
        });
      }
    });
    await uploadTask.start();
    while (!uploadTask.isCompleted()) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    sendProgress(uploadId, { status: 'uploading_to_bos_completed', message: 'BOS: Finished.', progress: 90 });
    logger.info(`uploadLocalToDataset: BOS upload completed.`, { requestId, uploadId, fileName, fileKey });
    
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); 
    logger.debug('uploadLocalToDataset: Temporary file deleted.', { requestId, uploadId, tempPath });

    logger.debug(`uploadLocalToDataset: Registering file with AI Studio.`, { requestId, uploadId, fileName, fileKey });
    const addFileResp = await aiStudio.addFile(fileName, fileKey, false);
    logger.debug(`uploadLocalToDataset: AI Studio addFile response.`, { requestId, uploadId, responseBody: addFileResp.body });

    if (!addFileResp || !addFileResp.body || !addFileResp.body.result || !addFileResp.body.result.fileId) {
      logger.error('uploadLocalToDataset: Failed to register file with AI Studio.', { requestId, uploadId, fileName, error: addFileResp.body?.error_msg, responseBody: addFileResp.body });
      sendProgress(uploadId, { status: 'failed', message: 'Failed to add file to AI Studio.', error: addFileResp.body?.error_msg || '响应格式错误' });
      closeConnection(uploadId);
      throw new Error(`添加到AI Studio失败 (本地上传): ${addFileResp.body?.error_msg || '响应格式错误'}`);
    }
    const fileId = addFileResp.body.result.fileId;
    logger.info(`uploadLocalToDataset: File registered with AI Studio.`, { requestId, uploadId, fileName, fileId });

    sendProgress(uploadId, { 
      status: 'completed', 
      message: 'File upload completed successfully.',
      fileId: fileId, 
      fileAbs: fileName,
      progress: 100
    });
    closeConnection(uploadId);
    logger.info('uploadLocalToDataset: Operation completed successfully.', { requestId, uploadId, fileName, fileId });
    res.json({
      success: true,
      fileId,
      fileAbs: fileName 
    });
  } catch (error) {
    logger.error('uploadLocalToDataset: Unhandled error during upload.', { requestId, uploadId, error: error.message, stack: error.stack, path: req.path, bodyFilename: req.file?.originalname });
    sendProgress(uploadId, { status: 'failed', message: error.message || '本地文件上传到数据集失败', error: error.message });
    closeConnection(uploadId);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        logger.error('uploadLocalToDataset: Failed to clean up temp file on error.', { requestId, uploadId, tempPath: req.file.path, error: e.message });
      }
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || '本地文件上传到数据集失败' 
    });
  }
};

export const fetchUrlToDataset = async (req, res) => {
  const { url, fileName, referer, userAgent, datasetName, datasetAbs, tags, uploadId } = req.body;
  const requestId = req.id;
  
  logger.info('Starting fetchUrlToDataset.', { requestId, uploadId, url, fileName, targetDatasetName: datasetName });
  logBusiness('Fetch URL to Dataset', { requestId, uploadId, url, fileName, targetDatasetName: datasetName });

  if (!uploadId) {
    logger.warn('fetchUrlToDataset: uploadId is missing from request body.', { requestId });
    return res.status(400).json({ success: false, error: 'uploadId is required for progress reporting.' });
  }

  try {
    const aiStudio = await getInitializedAIStudio(requestId);
    logger.info('Initiating URL fetch processing.', { requestId, uploadId, url, fileName });
    sendProgress(uploadId, { status: 'processing_server', message: 'Starting URL fetch...', progress: 0 });

    if (!url || !fileName) {
      logger.warn('fetchUrlToDataset: Missing required parameters url or fileName.', { requestId, uploadId, url, fileName });
      sendProgress(uploadId, { status: 'failed', message: 'URL and FileName are required.', error: 'Missing parameters' });
      closeConnection(uploadId);
      return res.status(400).json({ success: false, error: '缺少必要参数: url and fileName' });
    }

    try {
      validateDatasetParams({ fileName, datasetName: datasetName || fileName, datasetAbs: datasetAbs || '通过URL抓取上传的文件', tags: tags || [], fileIds: [1], fileSize: 0 });
      logger.debug('fetchUrlToDataset: Parameters validated.', { requestId, uploadId });
    } catch (error) {
      logger.warn('fetchUrlToDataset: Parameter validation failed.', { requestId, uploadId, error: error.message });
      sendProgress(uploadId, { status: 'failed', message: `Validation error: ${error.message}`, error: error.message });
      closeConnection(uploadId);
      return res.status(400).json({ success: false, error: error.message });
    }

    const { client, fileKey, bucketName } = await aiStudio.bosClient(false);
    logger.debug('fetchUrlToDataset: BOS client obtained.', { requestId, uploadId });
    const options = { 'x-bce-fetch-source': url };
    if (referer) options['x-bce-fetch-referer'] = referer;
    if (userAgent) options['x-bce-fetch-user-agent'] = userAgent;

    logger.info('fetchUrlToDataset: Starting fetch to BOS.', { requestId, uploadId, bucketName, fileKey, url, options });
    sendProgress(uploadId, { status: 'uploading_to_bos_started', message: 'BOS: Fetching URL...', progress: 10 });
    
    await client.fetchObject(bucketName, fileKey, options);
    logger.info(`fetchUrlToDataset: BOS fetchObject task submitted. Waiting for completion.`, { requestId, uploadId, fileKey });
    sendProgress(uploadId, { status: 'uploading_to_bos_processing', message: 'BOS is fetching the file...', progress: 50 });
    
    // This is a fire-and-forget from BOS perspective; actual fetch is async on BOS side.
    // The 5s delay is a heuristic. True progress would need BOS webhooks or polling.
    await new Promise(resolve => setTimeout(resolve, 5000)); 
    sendProgress(uploadId, { status: 'uploading_to_bos_completed', message: 'BOS: Fetch likely complete.', progress: 90 });
    logger.info(`fetchUrlToDataset: Assumed BOS fetch completion.`, { requestId, uploadId, fileKey });

    logger.debug(`fetchUrlToDataset: Registering file with AI Studio.`, { requestId, uploadId, fileName, fileKey });
    const addFileResp = await aiStudio.addFile(fileName, fileKey, false);
    logger.debug(`fetchUrlToDataset: AI Studio addFile response.`, { requestId, uploadId, responseBody: addFileResp.body });

    if (!addFileResp || !addFileResp.body || !addFileResp.body.result || !addFileResp.body.result.fileId) {
      logger.error('fetchUrlToDataset: Failed to register file with AI Studio.', { requestId, uploadId, fileName, error: addFileResp.body?.error_msg, responseBody: addFileResp.body });
      sendProgress(uploadId, { status: 'failed', message: 'Failed to add file to AI Studio.', error: addFileResp.body?.error_msg || '响应格式错误' });
      closeConnection(uploadId);
      throw new Error(`添加到AI Studio失败 (URL抓取): ${addFileResp.body?.error_msg || '响应格式错误'}`);
    }
    const fileId = addFileResp.body.result.fileId;
    logger.info(`fetchUrlToDataset: File registered with AI Studio.`, { requestId, uploadId, fileName, fileId });

    sendProgress(uploadId, { 
      status: 'completed', 
      message: 'URL fetch and processing completed.',
      fileId: fileId, 
      fileAbs: fileName,
      progress: 100
    });
    closeConnection(uploadId);
    logger.info('fetchUrlToDataset: Operation completed successfully.', { requestId, uploadId, fileName, fileId });
    res.json({
      success: true,
      fileId,
      message: '文件抓取并上传成功',
      fileAbs: fileName 
    });
  } catch (error) {
    logger.error('fetchUrlToDataset: Unhandled error during URL fetch.', { requestId, uploadId, url, error: error.message, stack: error.stack, path: req.path, body: req.body });
    sendProgress(uploadId, { status: 'failed', message: error.message || 'URL抓取上传失败', error: error.message });
    closeConnection(uploadId);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'URL抓取上传失败' 
    });
  }
};
