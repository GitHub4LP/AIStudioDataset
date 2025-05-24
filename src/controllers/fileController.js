import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { normalizeAndValidatePath } from '../utils/serverUtils.js';
import { logger, logError, logSecurity } from '../config/logger.js';

export const listFiles = async (req, res) => {
  const { path = '.' } = req.query;
  const serverDirname = req.app.locals.__dirname; 
  logger.info('Attempting to list files.', { requestId: req.id, path });

  try {
    const { fullPath, currentPath, isAllowed } = normalizeAndValidatePath(path, serverDirname);
    logger.debug('Path validation complete.', { requestId: req.id, path, fullPath, currentPath, isAllowed });
    
    if (!isAllowed) {
      logSecurity('非法路径访问 (listFiles)', { requestId: req.id, requestedPath: path, resolvedFullPath: fullPath });
      return res.status(403).json({ error: '访问被拒绝：路径超出允许范围' });
    }

    const items = await readdir(fullPath);
    logger.debug(`Successfully read directory contents for path: ${fullPath}`, { requestId: req.id, itemCount: items.length });

    const fileListPromises = items.map(async (name) => {
      const itemPath = join(fullPath, name);
      const stats = await stat(itemPath);
      return {
        name,
        type: stats.isDirectory() ? '文件夹' : '文件',
        size: stats.size
      };
    });
    const fileList = await Promise.all(fileListPromises);
    
    const parentPath = currentPath === '.' ? null : currentPath.split('/').slice(0, -1).join('/') || '.';
    logger.info('File list fetched successfully.', { requestId: req.id, path: currentPath, filesCount: fileList.length, parentPath });

    res.json({
      currentPath,
      parentPath,
      files: fileList
    });
  } catch (error) {
    logError('获取文件列表失败', { 
        requestId: req.id, 
        path, 
        error: error.message, 
        stack: error.stack,
        controller: 'fileController.listFiles'
    });
    res.status(500).json({ error: '获取文件列表失败' });
  }
};
