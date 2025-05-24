import express from 'express';
import { 
  getBosClientConfig,
  addFileToDatasetViaBos
} from '../controllers/bosController.js';

const router = express.Router();

// Route to get BOS client configuration (endpoint, bucketName)
// Original path: /api/get-bos-client
router.get('/client-config', getBosClientConfig);

// Route to add a file (already in BOS) to a dataset record in AI Studio
// Original path: /api/add-file-to-dataset
router.post('/add-file', addFileToDatasetViaBos);

export default router;
