import { getAIStudioInstance, initializeAIStudio } from '../services/aiStudioService.js';
import { validateDatasetParams } from '../api/aistudio.js'; 
import { DATASET_CONSTRAINTS } from '../utils/serverUtils.js'; 
import { logger, logError, logBusiness } from '../config/logger.js';

// Helper to get AI Studio instance, ensuring it's initialized
async function getInitializedAIStudio(requestId) {
  // logger.debug('Attempting to get AI Studio instance.', { requestId });
  try {
    const instance = await getAIStudioInstance();
    // logger.debug('Successfully retrieved AI Studio instance.', { requestId });
    return instance;
  } catch (error) {
    logger.warn('AI Studio instance was not ready, attempting re-initialization.', { requestId, error: error.message });
    try {
        const newInstance = await initializeAIStudio();
        logger.info('Re-initialization of AI Studio successful.', { requestId });
        return newInstance;
    } catch (initError) {
        logger.error('Failed to re-initialize AI Studio.', { requestId, error: initError.message, stack: initError.stack });
        throw initError; 
    }
  }
}

export const getPrivateDatasets = async (req, res) => {
  const { page: queryPage, pageSize: queryPageSize } = req.query;
  logger.info('Fetching private dataset list.', { requestId: req.id, queryPage, queryPageSize });
  try {
    const aiStudio = await getInitializedAIStudio(req.id);
    const page = parseInt(queryPage) || 1;
    const pageSize = parseInt(queryPageSize) || 10;
    
    const list_resp = await aiStudio.getPrivateList("", page, pageSize);
    logger.info('Private dataset list fetched successfully.', { requestId: req.id, page, pageSize, itemCount: list_resp.body?.result?.data?.length });
    res.json(list_resp.body);
  } catch (error) {
    logError('获取私有数据集列表失败', { requestId: req.id, error: error.message, stack: error.stack, path: req.path, query: req.query });
    res.status(500).json({ error: '获取私有数据集列表失败' });
  }
};

export const getDatasetDetail = async (req, res) => {
  const { datasetId } = req.params;
  logger.info('Fetching dataset detail.', { requestId: req.id, datasetId });
  try {
    const aiStudio = await getInitializedAIStudio(req.id);
    const detail_resp = await aiStudio.fetchDetail(datasetId);
    logger.info('Dataset detail fetched successfully.', { requestId: req.id, datasetId });
    res.json(detail_resp.body);
  } catch (error) {
    logError('获取数据集详情失败', { requestId: req.id, datasetId, error: error.message, stack: error.stack, path: req.path });
    res.status(500).json({ error: '获取数据集详情失败' });
  }
};

export const getDatasetFileDownloadUrl = async (req, res) => {
  const { datasetId, fileId } = req.params;
  logger.info('Fetching dataset file download URL.', { requestId: req.id, datasetId, fileId });
  try {
    const aiStudio = await getInitializedAIStudio(req.id);
    const parsedFileId = parseInt(fileId);
    if (isNaN(parsedFileId)) {
        logger.warn('Invalid fileId format for download URL.', { requestId: req.id, datasetId, fileId });
        return res.status(400).send('无效的文件ID');
    }
    const url_resp = await aiStudio.datasetFileDownload(datasetId, parsedFileId);
    const bosUrl = url_resp.body?.result?.bosUrl || '';
    logger.info('Dataset file download URL fetched successfully.', { requestId: req.id, datasetId, fileId, hasUrl: !!bosUrl });
    res.send(bosUrl);
  } catch (error) {
    logError('获取文件下载URL失败', { requestId: req.id, datasetId, fileId, error: error.message, stack: error.stack, path: req.path });
    res.send(''); 
  }
};

export const getDatasetConstraints = (req, res) => {
  logger.info('Fetching dataset constraints.', { requestId: req.id });
  // This is a synchronous operation returning static data, so extensive logging isn't as critical.
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
  });
  logger.info('Dataset constraints returned.', { requestId: req.id });
};

export const getDatasetCount = async (req, res) => {
  logger.info('Fetching dataset count.', { requestId: req.id });
  try {
    const aiStudio = await getInitializedAIStudio(req.id);
    const list_resp = await aiStudio.getPrivateList("", 1, 1);
    if (list_resp && list_resp.body && list_resp.body.result) {
      logger.info('Dataset count fetched successfully.', { requestId: req.id, count: list_resp.body.result.totalCount });
      res.json(list_resp.body.result.totalCount);
    } else {
      logger.warn('Failed to get dataset count: Invalid response structure.', { requestId: req.id, responseBody: list_resp.body });
      throw new Error('获取数据集数量失败: 响应格式不正确');
    }
  } catch (error) {
    logError('获取数据集数量失败', { requestId: req.id, error: error.message, stack: error.stack, path: req.path });
    res.status(500).json({ error: '获取数据集数量失败' });
  }
};

export const createDataset = async (req, res) => {
  const { datasetName, datasetAbs, tags, fileIds, fileAbsList } = req.body;
  logger.info('Attempting to create new dataset.', { requestId: req.id, datasetName, datasetAbsLength: datasetAbs?.length, tagCount: tags?.length, fileCount: fileIds?.length });
  logBusiness('业务操作 - 创建数据集', { requestId: req.id, operation: 'create', details: { datasetName, datasetAbsLength: datasetAbs?.length, tagCount: tags?.length, fileCount: fileIds?.length } });

  try {
    const aiStudio = await getInitializedAIStudio(req.id);
    
    const list_resp = await aiStudio.getPrivateList("", 1, 1);
    if (list_resp && list_resp.body && list_resp.body.result) {
      const currentCount = list_resp.body.result.totalCount;
      logger.info(`Current dataset count: ${currentCount}/${DATASET_CONSTRAINTS.MAX_DATASETS_COUNT}`, { requestId: req.id, currentCount, maxCount: DATASET_CONSTRAINTS.MAX_DATASETS_COUNT });
      if (currentCount >= DATASET_CONSTRAINTS.MAX_DATASETS_COUNT) {
        logger.warn('Create dataset failed: Max dataset count reached.', { requestId: req.id, currentCount });
        return res.status(400).json({
          success: false,
          error: `创建失败：已达到最大数据集数量限制（${DATASET_CONSTRAINTS.MAX_DATASETS_COUNT}个）`
        });
      }
    }

    validateDatasetParams({ datasetName, datasetAbs, tags, fileIds, fileAbsList: fileAbsList || [] });
    logger.debug('Dataset parameters validated successfully.', { requestId: req.id });
    
    const normalizedFileAbsList = (fileAbsList || []).map(fab => fab.split('\\').join('/'));

    const createResp = await aiStudio.create(
      datasetName,
      datasetAbs || '',
      datasetAbs || '', 
      tags || [],
      fileIds,
      normalizedFileAbsList,
      0 
    );
    logger.debug('AI Studio create dataset response received.', { requestId: req.id, responseBody: createResp.body });

    if (!createResp || !createResp.body) {
      logger.error('Create dataset failed: Empty response from AI Studio.', { requestId: req.id, datasetName });
      throw new Error('创建数据集失败: 服务器响应为空');
    }
    if (createResp.body.error_code) {
      logger.error('Create dataset failed: AI Studio error.', { requestId: req.id, datasetName, errorCode: createResp.body.error_code, errorMsg: createResp.body.error_msg });
      throw new Error(`创建数据集失败: ${createResp.body.error_msg || '未知AI Studio错误'}`);
    }
    if (!createResp.body.result || !createResp.body.result.datasetId) {
      logger.error('Create dataset failed: Dataset ID missing in AI Studio response.', { requestId: req.id, datasetName, responseBody: createResp.body });
      throw new Error('创建数据集失败: 响应中未包含数据集ID');
    }
    const newDatasetId = createResp.body.result.datasetId;
    logger.info('Dataset created successfully.', { requestId: req.id, datasetName, newDatasetId });
    res.json({
      success: true,
      datasetId: newDatasetId
    });
  } catch (error) {
    logError('创建数据集失败', { requestId: req.id, datasetName, error: error.message, stack: error.stack, path: req.path, body: req.body });
    const isValidationError = error.message.includes('验证失败') || error.message.includes('不能为空') || error.message.includes('长度不能超过');
    res.status(isValidationError ? 400 : 500).json({ 
      success: false,
      error: error.message || '创建数据集失败'
    });
  }
};

export const updateDataset = async (req, res) => {
  const { datasetId } = req.params;
  const { datasetName, datasetAbs, tags, fileIds, fileAbsList, ispublic } = req.body;
  logger.info('Attempting to update dataset.', { requestId: req.id, datasetId, datasetName });
  logBusiness('业务操作 - 更新数据集', { requestId: req.id, operation: 'update', datasetId, details: { datasetName, datasetAbsLength: datasetAbs?.length, fileCount: fileIds?.length } });

  if (!datasetId) {
    logger.warn('Update dataset failed: Missing datasetId.', { requestId: req.id });
    return res.status(400).json({ success: false, error: 'Dataset ID is required' });
  }
  
  try {
    const aiStudio = await getInitializedAIStudio(req.id);
    validateDatasetParams({ datasetName, datasetAbs, tags, fileIds }); // fileAbsList not directly validated here by this func
    logger.debug('Dataset parameters for update validated successfully.', { requestId: req.id, datasetId });

    const datasetContent = datasetAbs || ''; 
    const finalIspublic = typeof ispublic === 'number' ? ispublic : 0;
    const normalizedFileAbsList = (fileAbsList || []).map(fab => fab.split('\\').join('/'));

    const editResp = await aiStudio.saveEdit(
      datasetId,
      datasetName,
      datasetAbs,
      datasetContent,
      tags || [],
      fileIds,
      normalizedFileAbsList,
      finalIspublic
    );
    logger.debug('AI Studio saveEdit dataset response received.', { requestId: req.id, datasetId, responseBody: editResp.body });

    if (!editResp || !editResp.body) {
      logger.error('Update dataset failed: Empty response from AI Studio.', { requestId: req.id, datasetId });
      throw new Error('更新数据集失败: AI Studio响应为空');
    }
    if (editResp.body.error_code) {
      logger.error('Update dataset failed: AI Studio error.', { requestId: req.id, datasetId, errorCode: editResp.body.error_code, errorMsg: editResp.body.error_msg });
      throw new Error(`更新数据集失败: ${editResp.body.error_msg || '未知AI Studio错误'}`);
    }
    
    if (editResp.body.result) {
      logger.info('Dataset updated successfully.', { requestId: req.id, datasetId });
      res.json({
        success: true,
        message: '数据集更新成功',
        result: editResp.body.result
      });
    } else {
      logger.warn('Update dataset response from AI Studio did not include a result, but no error code.', { requestId: req.id, datasetId, responseBody: editResp.body });
      res.json({
        success: true,
        message: '数据集更新操作已提交' 
      });
    }
  } catch (error) {
    logError('更新数据集失败', { requestId: req.id, datasetId, error: error.message, stack: error.stack, path: req.path, body: req.body });
    const isValidationError = error.message.includes('验证失败') || error.message.includes('不能为空') || error.message.includes('长度不能超过');
    res.status(isValidationError ? 400 : 500).json({
      success: false,
      error: error.message || '更新数据集失败'
    });
  }
};

export const deleteDataset = async (req, res) => {
  const { datasetId } = req.params;
  logger.info(`Attempting to delete dataset ${datasetId}.`, { requestId: req.id, datasetId });
  logBusiness('业务操作 - 删除数据集', { requestId: req.id, operation: 'delete', datasetId });
    
  if (!datasetId) {
    logger.warn('Delete dataset failed: Missing datasetId.', { requestId: req.id });
    return res.status(400).json({ success: false, error: '缺少数据集ID' });
  }

  try {
    const aiStudio = await getInitializedAIStudio(req.id);
    
    const usedResponse = await aiStudio.getDatasetUsed(datasetId);
    logger.debug('AI Studio getDatasetUsed response received.', { requestId: req.id, datasetId, responseBody: usedResponse.body });
    if (!usedResponse.body) {
      logger.error('Delete dataset check failed: Empty response from AI Studio for getDatasetUsed.', { requestId: req.id, datasetId });
      throw new Error('检查数据集使用状态失败: AI Studio响应为空');
    }
    if (usedResponse.body.errorCode !== 0) {
      logger.error('Delete dataset check failed: AI Studio error for getDatasetUsed.', { requestId: req.id, datasetId, errorCode: usedResponse.body.errorCode, errorMsg: usedResponse.body.errorMsg });
      throw new Error(`检查数据集使用状态失败: ${usedResponse.body.errorMsg || '未知AI Studio错误'}`);
    }
    if (usedResponse.body.result === true) {
      logger.warn(`Delete dataset failed: Dataset ${datasetId} is in use.`, { requestId: req.id });
      return res.status(400).json({ success: false, error: '数据集正在被使用，无法删除' });
    }

    const response = await aiStudio.del(datasetId);
    logger.debug('AI Studio delete dataset response received.', { requestId: req.id, datasetId, responseBody: response.body });
    if (!response.body) {
      logger.error('Delete dataset failed: Empty response from AI Studio for del operation.', { requestId: req.id, datasetId });
      throw new Error('删除数据集失败: AI Studio响应为空');
    }
    if (response.body.errorCode !== 0) {
      logger.error('Delete dataset failed: AI Studio error for del operation.', { requestId: req.id, datasetId, errorCode: response.body.errorCode, errorMsg: response.body.errorMsg });
      throw new Error(`删除数据集失败: ${response.body.errorMsg || '未知AI Studio错误'}`);
    }
    
    logger.info(`Dataset ${datasetId} deleted successfully.`, { requestId: req.id });
    res.json({ success: true, message: '数据集删除成功' });
  } catch (error) {
    logError('删除数据集失败', { requestId: req.id, datasetId, error: error.message, stack: error.stack, path: req.path });
    const isOperationalError = error.message.includes('无法删除') || error.message.includes('使用状态失败');
    res.status(isOperationalError ? 400 : 500).json({ 
      success: false, 
      error: error.message || '删除数据集失败' 
    });
  }
};

export const deleteFileFromDataset = async (req, res) => {
  const { datasetId, fileId } = req.params;
  logger.info(`Attempting to delete file ${fileId} from dataset ${datasetId}.`, { requestId: req.id, datasetId, fileId });
  logBusiness('业务操作 - 从数据集中删除文件', { requestId: req.id, operation: 'deleteFile', datasetId, fileId });

  if (!datasetId || !fileId) {
    logger.warn('Delete file from dataset failed: Missing datasetId or fileId.', { requestId: req.id, datasetId, fileId });
    return res.status(400).json({ success: false, error: '数据集ID和文件ID都是必需的' });
  }
  const parsedFileId = parseInt(fileId);
  if (isNaN(parsedFileId)) {
      logger.warn('Delete file from dataset failed: Invalid fileId format.', { requestId: req.id, datasetId, fileId });
      return res.status(400).json({ success: false, error: '无效的文件ID格式' });
  }
  
  try {
    const aiStudio = await getInitializedAIStudio(req.id);
    
    const datasetDetailResp = await aiStudio.fetchDetail(datasetId);
    logger.debug('AI Studio fetchDetail response received for deleteFile.', { requestId: req.id, datasetId, hasBody: !!datasetDetailResp.body });
    if (!datasetDetailResp || !datasetDetailResp.body || !datasetDetailResp.body.result) {
      logger.error('Delete file failed: Could not fetch dataset details or dataset not found.', {
        requestId: req.id, datasetId, hasDetail: !!datasetDetailResp, hasBody: !!(datasetDetailResp && datasetDetailResp.body), hasResult: !!(datasetDetailResp && datasetDetailResp.body && datasetDetailResp.body.result)
      });
      return res.status(404).json({ success: false, error: '数据集不存在或无法获取详情' });
    }

    const dataset = datasetDetailResp.body.result;
    const fileList = dataset.fileList || [];
    
    const fileIndex = fileList.findIndex(f => f.fileId === parsedFileId);
    if (fileIndex === -1) {
      logger.warn(`Delete file failed: File ${fileId} not found in dataset ${datasetId}.`, { requestId: req.id });
      return res.status(404).json({ success: false, error: '文件不存在于数据集中' });
    }

    fileList.splice(fileIndex, 1);
    logger.debug(`File ${fileId} removed from local fileList for dataset ${datasetId}.`, { requestId: req.id });

    const updateData = {
      datasetId,
      datasetName: dataset.datasetName,
      datasetAbs: dataset.datasetAbs || dataset.datasetName || '数据集描述', 
      datasetContent: dataset.datasetContent || dataset.datasetAbs || dataset.datasetName || '数据集内容', 
      tags: dataset.tags || [],
      fileIds: fileList.map(f => f.fileId),
      fileAbsList: fileList.map(f => f.fileAbs.split('\\').join('/')), 
      ispublic: typeof dataset.public === 'number' ? dataset.public : 0 
    };
    
    // Optional: Re-validate before saving, though less critical here.
    // validateDatasetParams({ datasetName: updateData.datasetName, datasetAbs: updateData.datasetAbs, tags: updateData.tags, fileIds: updateData.fileIds });

    const editResp = await aiStudio.saveEdit(
      updateData.datasetId,
      updateData.datasetName,
      updateData.datasetAbs,
      updateData.datasetContent,
      updateData.tags,
      updateData.fileIds,
      updateData.fileAbsList,
      updateData.ispublic
    );
    logger.debug('AI Studio saveEdit (after file removal) response received.', { requestId: req.id, datasetId, responseBody: editResp.body });

    if (!editResp || !editResp.body || editResp.body.error_code) {
      logger.error('Update dataset (after file removal) failed: AI Studio error.', {
        requestId: req.id, datasetId, errorCode: editResp?.body?.error_code, errorMsg: editResp?.body?.error_msg
      });
      throw new Error(editResp?.body?.error_msg || '更新数据集（删除文件后）失败');
    }

    logger.info(`File ${fileId} successfully deleted from dataset ${datasetId}.`, { requestId: req.id });
    res.json({ success: true, message: '文件已成功从数据集中移除' });
  } catch (error) {
    logError('从数据集中删除文件失败', { requestId: req.id, datasetId, fileId, error: error.message, stack: error.stack, path: req.path });
    res.status(500).json({ success: false, error: error.message || '删除文件时发生错误' });
  }
};
