import express from 'express';
import { listFiles } from '../controllers/fileController.js';

const router = express.Router();

// Route for listing files and directories
router.get('/files', listFiles);

export default router;
