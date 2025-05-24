import fs from 'fs';
import { AI_Studio } from '../api/aistudio.js';
import { logger, logPerformance, logError } from '../config/logger.js';

let aiStudioInstance = null;
let cookie = '';

// 尝试从文件读取cookie
try {
  cookie = fs.readFileSync('cookie.txt', 'utf8');
  logger.info('成功从文件读取cookie');
} catch (err) {
  logger.debug('从文件读取cookie失败:', err);
}

// 设置cookie的函数
export function setCookie(newCookie) {
  if (!newCookie) {
    logger.error('尝试设置空的cookie');
    return false;
  }
  cookie = newCookie;
  // 重置实例，这样下次获取时会使用新的cookie重新初始化
  aiStudioInstance = null;
  logger.info('成功设置新的cookie');
  return true;
}

// 获取当前cookie
export function getCookie() {
  return cookie;
}

async function initializeAIStudio() {
  if (!cookie) {
    throw new Error('未找到有效的cookie');
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
    logger.warn('AI Studio 实例尚未初始化，但被请求。');
    throw new Error('AI Studio 实例未初始化。请确保在服务器启动时已成功初始化。');
  }
  return aiStudioInstance;
}

export { initializeAIStudio, getAIStudioInstance };
