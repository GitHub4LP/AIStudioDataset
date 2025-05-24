import { normalize, join } from 'path';
import { ALLOWED_PATHS } from '../config/paths.js';

// 数据集约束条件
export const DATASET_CONSTRAINTS = {
  MAX_FILE_NAME_LENGTH: 50,
  MAX_DATASET_NAME_DISPLAY_LENGTH: 40,
  MAX_DATASET_NAME_LENGTH: 100,
  MAX_DATASET_ABS_LENGTH: 200,
  MAX_TAG_LENGTH: 10,
  MAX_TAG_LENGTH_ALL: 127,
  MAX_TAGS_COUNT: 5,
  MAX_FILE_ABS_LENGTH: 499,
  MAX_FILES_PER_DATASET: 10,
  MAX_DATASET_SIZE_GB: 50,
  MAX_DATASETS_COUNT: 60
};

// 检查路径是否在允许范围内，并返回规范化的路径
export function normalizeAndValidatePath(path, __dirname_provided = null) {
  // 如果是别名，转换为实际路径
  const baseConfig = ALLOWED_PATHS.find(p => p.alias === path);
  if (baseConfig) {
    return {
      fullPath: normalize(baseConfig.path),
      currentPath: path,
      isAllowed: true
    };
  }

  // 处理相对路径
  const pathParts = path.split('/');
  const basePath = pathParts[0];
  const subConfig = ALLOWED_PATHS.find(p => p.alias === basePath);
  
  if (subConfig) {
    const subPath = pathParts.slice(1).join('/');
    const fullPath = normalize(join(subConfig.path, subPath));
    return {
      fullPath,
      currentPath: path,
      isAllowed: true
    };
  }

  // 如果路径不是以允许的路径开头，则拒绝访问
  // __dirname_provided should be the __dirname from the calling context (server.js)
  const effectiveDirname = __dirname_provided || ''; // Fallback, though __dirname should always be passed
  const fullPath = normalize(join(effectiveDirname, path));
  const isAllowed = ALLOWED_PATHS.some(p => 
    fullPath.startsWith(normalize(p.path))
  );

  return {
    fullPath,
    currentPath: path,
    isAllowed
  };
}
