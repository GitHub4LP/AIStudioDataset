import { logger } from '../config/logger.js';

const clients = new Map(); // Maps uploadId to Express response object

export const addClient = (uploadId, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush the headers to establish the connection

  clients.set(uploadId, res);
  logger.info(`SSE Client connected for uploadId: ${uploadId}`);

  res.on('close', () => {
    clients.delete(uploadId);
    logger.info(`SSE Client disconnected for uploadId: ${uploadId}`);
  });
};

export const sendProgress = (uploadId, data) => {
  const res = clients.get(uploadId);
  if (res) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    res.write(message);
    // logger.debug(`SSE Sent to ${uploadId}: ${JSON.stringify(data)}`);
  } else {
    // logger.warn(`SSE: No client found for uploadId: ${uploadId}. Data not sent: ${JSON.stringify(data)}`);
  }
};

export const closeConnection = (uploadId, finalMessage) => {
  if (finalMessage) {
    sendProgress(uploadId, finalMessage);
  }
  const res = clients.get(uploadId);
  if (res) {
    res.end(); // Close the connection
    clients.delete(uploadId); // Remove from map
    logger.info(`SSE Connection explicitly closed for uploadId: ${uploadId}`);
  }
};

export const getActiveConnections = () => {
  return clients.size;
};
