import { getAIStudioInstance, initializeAIStudio } from '../services/aiStudioService.js';
import { logger, logError } from '../config/logger.js';

// Helper to get AI Studio instance, ensuring it's initialized
async function getInitializedAIStudio() {
  // Ensure aiStudioService is initialized if not already
  // This is a bit of a safeguard; ideally, server startup ensures this.
  try {
    const instance = await getAIStudioInstance();
    // logger.debug('Successfully retrieved AI Studio instance in bosController');
    return instance;
  } catch (error) {
    logger.warn('AI Studio instance was not ready in bosController, attempting re-initialization.', { error: error.message });
    try {
        const newInstance = await initializeAIStudio(); // Attempt to initialize if not available
        logger.info('Re-initialization of AI Studio successful in bosController.');
        return newInstance;
    } catch (initError) {
        logger.error('Failed to re-initialize AI Studio in bosController.', { error: initError.message, stack: initError.stack });
        throw initError; // Re-throw if initialization fails, as controllers depend on it
    }
  }
}

export const getBosClientConfig = async (req, res) => {
  logger.info('Attempting to get BOS client configuration.', { requestId: req.id });
  try {
    const aiStudio = await getInitializedAIStudio();
    logger.debug('AI Studio instance obtained for getBosClientConfig.', { requestId: req.id });
    
    const { endpoint, bucketName } = await aiStudio.bosClient(false); 
    logger.info('BOS client configuration fetched successfully.', { requestId: req.id, endpoint, bucketName });

    res.json({
      endpoint,
      bucketName
    });
  } catch (error) {
    logError('获取BOS客户端配置失败', { 
        requestId: req.id, 
        error: error.message, 
        stack: error.stack, 
        path: req.path 
    });
    res.status(500).json({
      success: false,
      error: error.message || '获取BOS客户端配置失败'
    });
  }
};

export const addFileToDatasetViaBos = async (req, res) => {
  const { fileName, fileKey, bucketName } = req.body; // bucketName from body is not actually used by aiStudio.addFile
  logger.info('Attempting to add file to dataset via BOS.', { requestId: req.id, fileName, fileKey });

  if (!fileName || !fileKey) {
    logger.warn('addFileToDatasetViaBos: Missing required parameters.', { requestId: req.id, fileName, fileKey });
    return res.status(400).json({ success: false, error: '缺少必要参数: fileName and fileKey are required.' });
  }

  try {
    const aiStudio = await getInitializedAIStudio();
    logger.debug('AI Studio instance obtained for addFileToDatasetViaBos.', { requestId: req.id });
    
    const addFileResp = await aiStudio.addFile(fileName, fileKey, false); 
    logger.debug('AI Studio addFile response received.', { requestId: req.id, responseBody: addFileResp.body });


    if (!addFileResp || !addFileResp.body || !addFileResp.body.result || !addFileResp.body.result.fileId) {
      logger.error('添加到数据集失败 (BOS Controller): Invalid response structure from AI Studio.', { 
        requestId: req.id, 
        fileName, 
        fileKey, 
        response: addFileResp.body 
      });
      throw new Error(`添加到数据集失败: ${addFileResp.body?.error_msg || '响应格式错误或操作失败'}`);
    }
    
    const fileId = addFileResp.body.result.fileId;
    logger.info('File added to dataset via BOS successfully.', { requestId: req.id, fileName, fileKey, fileId });
    res.json({
      success: true,
      fileId: fileId
    });
  } catch (error) {
    logError('添加到数据集失败 (BOS Controller)', { 
        requestId: req.id, 
        fileName, 
        fileKey, 
        error: error.message, 
        stack: error.stack, 
        path: req.path 
    });
    res.status(500).json({
      success: false,
      error: error.message || '添加到数据集失败'
    });
  }
};
