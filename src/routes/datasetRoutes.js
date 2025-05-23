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

export default router;
