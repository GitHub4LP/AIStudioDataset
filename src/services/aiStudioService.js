import fs from 'fs';
import { AI_Studio } from '../api/aistudio.js';
import { logger, logPerformance, logError } from '../config/logger.js';

let aiStudioInstance = null;
let cookie = '';

try {
  cookie = fs.readFileSync('cookie.txt', 'utf8');
} catch (err) {
  logger.error('读取 cookie 失败:', err);
  // Consider whether to throw an error here or let initialization fail
}

async function initializeAIStudio() {
  if (!cookie) {
    throw new Error('未找到 cookie.txt 文件或读取失败');
  }
  if (!aiStudioInstance) {
    logger.info('正在初始化 AI Studio...');
    const initStartTime = Date.now();
    try {
      const instance = new AI_Studio(cookie);
      aiStudioInstance = await instance.initialize();
      logPerformance('AI Studio初始化', initStartTime);
      logger.info('AI Studio 初始化成功');

      // Optional: Perform an initial check like getting dataset list
      const listStartTime = Date.now();
      const list_resp = await aiStudioInstance.getPrivateList("", 1, 1);
      logPerformance('首次获取数据集列表 (初始化检查)', listStartTime);
      if (list_resp && list_resp.body && list_resp.body.result) {
        logger.info('AI Studio 连接正常，数据集统计', {
          totalCount: list_resp.body.result.totalCount
        });
      } else {
        logger.warn('AI Studio 初始化后获取数据集列表似乎未返回预期结果。');
      }
    } catch (error) {
      logError('AI Studio 初始化失败', error);
      aiStudioInstance = null; // Reset instance on failure
      throw error; // Re-throw to indicate initialization failure
    }
  }
  return aiStudioInstance;
}

function getAIStudioInstance() {
  if (!aiStudioInstance) {
    // This case should ideally be handled by ensuring initializeAIStudio is called and awaited at startup.
    // Throwing an error or attempting re-initialization depends on desired behavior.
    // For now, assume initialization is handled at server start.
    logger.warn('AI Studio 实例尚未初始化，但被请求。');
    throw new Error('AI Studio 实例未初始化。请确保在服务器启动时已成功初始化。');
  }
  return aiStudioInstance;
}

export { initializeAIStudio, getAIStudioInstance };
