import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 允许的路径配置
export const ALLOWED_PATHS = [
  {
    name: '项目根目录',
    path: join(__dirname, '../../'),
    alias: '.'
  },
  {
    name: '上传目录',
    path: join(__dirname, '../../uploads'),
    alias: 'uploads'
  },
  {
    name: '下载目录',
    path: 'D:/Downloads',
    alias: 'downloads'
  }
] 