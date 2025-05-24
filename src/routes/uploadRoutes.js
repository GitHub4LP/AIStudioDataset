import express from 'express';
import { 
  uploadToServerDataset,
  uploadLocalToDataset,
  fetchUrlToDataset 
} from '../controllers/uploadController.js';
import multer from 'multer';
import fs from 'fs'; // Needed for creating 'uploads/' directory if it doesn't exist

// Configure multer storage
const uploadDir = 'uploads/';
// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename, ensure UTF-8 encoding is handled
    // The original server.js had a fileFilter for this.
    // We'll ensure the filename is properly decoded to UTF-8 before saving or using.
    // For multer, it's best to handle encoding issues in the controller or a custom middleware,
    // as multer itself might not robustly handle all encoding scenarios for filenames directly.
    // The fileFilter in the original server.js was:
    // file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
    // This logic should be applied in the controller when accessing req.file.originalname if needed.
    // For now, multer saves with the name it receives.
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // It's crucial to handle filename encoding correctly.
    // If files are uploaded with non-ASCII names, they might be garbled
    // if not decoded/encoded consistently.
    // The original server.js decoded from latin1 to utf8.
    // This filter ensures that `file.originalname` is UTF-8 encoded
    // by the time it reaches the controller.
    try {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
        // Log error or handle as per application's error handling strategy
        console.error("Error decoding filename:", e);
        return cb(new Error("Filename encoding error"));
    }
    cb(null, true);
  }
});

const router = express.Router();

// Route for uploading files from server's local file system to a dataset
router.post('/to-dataset', uploadToServerDataset); // Corresponds to /api/upload-to-dataset

// Route for uploading local files (e.g., from user's computer via browser) to a dataset
// The 'upload.single('file')' middleware processes the 'file' field from the multipart/form-data
router.post('/local-to-dataset', upload.single('file'), uploadLocalToDataset); // Corresponds to /api/upload-local-to-dataset

// Route for fetching a file from a URL and adding it to a dataset
router.post('/fetch-to-dataset', fetchUrlToDataset); // Corresponds to /api/fetch-to-dataset

export default router;
