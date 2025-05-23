import express from 'express';
import { addClient } from '../utils/sseManager.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Endpoint for clients to connect for SSE updates
router.get('/upload-progress/:uploadId', (req, res) => {
  const { uploadId } = req.params;
  if (!uploadId) {
    logger.warn('SSE connection attempt without uploadId');
    return res.status(400).send('uploadId is required');
  }

  logger.info(`SSE connection request received for uploadId: ${uploadId}`);
  addClient(uploadId, res);

  // Send a confirmation message or initial status if desired
  // sendProgress(uploadId, { status: 'connected', message: 'SSE connection established.' });
});

export default router;
