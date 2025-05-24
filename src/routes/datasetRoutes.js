import express from 'express';
import {
  getPrivateDatasets,
  getDatasetDetail,
  getDatasetFileDownloadUrl,
  getDatasetConstraints,
  getDatasetCount,
  createDataset,
  updateDataset,
  deleteDataset,
  deleteFileFromDataset
} from '../controllers/datasetController.js';
import { setCookie, getCookie } from '../services/aiStudioService.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Routes for dataset management
router.get('/private', getPrivateDatasets); // GET /api/datasets/private
router.get('/count', getDatasetCount); // GET /api/datasets/count
router.get('/constraints', getDatasetConstraints); // GET /api/datasets/constraints (moved from /api/dataset-constraints)

router.post('/', createDataset); // POST /api/datasets (changed from /api/create-dataset for RESTful pattern)
router.get('/:datasetId/detail', getDatasetDetail); // GET /api/datasets/:datasetId/detail
router.put('/:datasetId', updateDataset); // PUT /api/datasets/:datasetId
router.delete('/:datasetId', deleteDataset); // DELETE /api/datasets/:datasetId

router.get('/:datasetId/files/:fileId/url', getDatasetFileDownloadUrl); // GET /api/datasets/:datasetId/files/:fileId/url
router.delete('/:datasetId/files/:fileId', deleteFileFromDataset); // DELETE /api/datasets/:datasetId/files/:fileId

// 设置cookie的路由
router.post('/cookie', async (req, res) => {
  const { cookie } = req.body;
  if (!cookie) {
    return res.status(400).json({
      success: false,
      error: '未提供cookie'
    });
  }

  try {
    const success = setCookie(cookie);
    if (success) {
      res.json({
        success: true,
        message: 'Cookie设置成功'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Cookie设置失败'
      });
    }
  } catch (error) {
    logger.error('设置cookie时发生错误:', error);
    res.status(500).json({
      success: false,
      error: '设置cookie时发生错误'
    });
  }
});

// 获取当前cookie状态的路由
router.get('/cookie/status', async (req, res) => {
  const cookie = getCookie();
  res.json({
    success: true,
    hasCookie: !!cookie
  });
});

export default router;
