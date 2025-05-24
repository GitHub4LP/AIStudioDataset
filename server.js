import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { createServer as createViteServer } from 'vite';
import fsSync from 'fs'; // Keep for cookie reading, if not moved to service init
import {
  logger,
  logPerformance,
  logSystemResources,
  logError,
  requestLogger
} from './src/config/logger.js';
import { initializeAIStudio, getAIStudioInstance } from './src/services/aiStudioService.js';

// Import route handlers
import fileRoutes from './src/routes/fileRoutes.js';
import datasetRoutes from './src/routes/datasetRoutes.js';
import uploadRoutes from './src/routes/uploadRoutes.js';
import bosRoutes from './src/routes/bosRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createServer() {
  const app = express();

  // Make __dirname available to request handlers if needed for path resolutions
  app.locals.__dirname = __dirname;
  
  // Add request logging middleware
  app.use(requestLogger);
  
  // Create Vite server
  const viteStartTime = Date.now();
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });
  logPerformance('Vite服务器创建', viteStartTime);
  logger.info('Vite 服务器已创建');

  // Initialize AI Studio Service
  try {
    await initializeAIStudio(); // This now handles logging and instance creation internally
    // Make AI Studio instance available to request handlers via app.locals
    // Controllers will use getAIStudioInstance() from the service.
    // However, if direct access is ever needed from req object, this would be one way.
    // app.locals.aiStudio = getAIStudioInstance(); 
  } catch (error) {
    logError('AI Studio 主服务初始化失败, 服务可能无法正常运行。', error);
    // Depending on severity, might want to exit or have degraded functionality
  }

  // 定期记录系统资源使用情况
  setInterval(logSystemResources, 5 * 60 * 1000); // 每5分钟记录一次

  // Use vite's middleware
  app.use(vite.middlewares);
  app.use(express.json()); // For parsing application/json
  
  // Mount the routers
  app.use('/api', fileRoutes); // Mounted at /api/files internally by the router
  app.use('/api/datasets', datasetRoutes);
  app.use('/api/upload', uploadRoutes); // e.g. /api/upload/to-dataset
  app.use('/api/bos', bosRoutes); // e.g. /api/bos/client-config

  // Catch-all for non-API routes, serve index.html for client-side routing
  app.use('*', async (req, res, next) => {
    // If it's an API request, it should have been handled by one of the routers.
    // If it reaches here, it's a 404 for an API endpoint.
    if (req.originalUrl.startsWith('/api/')) {
      // Let Express default 404 handler kick in or define a custom one if desired.
      return next(); 
    }

    // For non-API requests, serve the main HTML file for the Vite frontend.
    try {
      const template = await fs.readFile(join(__dirname, 'index.html'), 'utf-8');
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e); // Pass error to Vite's error handler / generic error handler
    }
  });

  // Centralized error handling middleware
  app.use((err, req, res, next) => {
    logger.error('服务器错误', {
      error: {
        message: err.message,
        stack: err.stack // Be cautious about exposing stack in production
      },
      request: {
        url: req.originalUrl,
        method: req.method,
        // body: req.body, // Be cautious logging sensitive body data
        params: req.params,
        query: req.query
      },
      timestamp: new Date().toISOString()
    });
    
    logSystemResources(); // Log system resources on error

    // Avoid sending stack trace in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message;
      
    // If headers already sent, delegate to default Express error handler
    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({ // Use error status if available, else 500
      success: false,
      error: errorMessage
    });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info('服务器启动', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    });
    logSystemResources(); // Log initial system resources
  });
}

// Global error handlers for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('未捕获的全局异常', { // Changed log message slightly for clarity
    error: {
      message: error.message,
      stack: error.stack
    },
    timestamp: new Date().toISOString()
  });
  logSystemResources();
  // Consider graceful shutdown here for critical errors: process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的全局Promise拒绝', { // Changed log message slightly
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason,
    // promise, // Logging the promise object itself might be too verbose
    timestamp: new Date().toISOString()
  });
  logSystemResources();
});

createServer();