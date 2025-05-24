import winston from 'winston'
import 'winston-daily-rotate-file'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 日志翻译映射
const logTranslations = {
  zh: {
    info: '信息',
    warning: '警告',
    error: '错误',
    debug: '调试',
    system: '系统',
    security: '安全',
    business: '业务'
  },
  en: {
    info: 'Info',
    warning: 'Warning',
    error: 'Error',
    debug: 'Debug',
    system: 'System',
    security: 'Security',
    business: 'Business'
  }
}

// 获取当前语言环境
const getCurrentLanguage = () => {
  const lang = process.env.LANGUAGE?.toLowerCase()
  return (lang && logTranslations[lang]) ? lang : 'zh'
}

// 翻译日志级别
const translateLogLevel = (level) => {
  const lang = getCurrentLanguage()
  return logTranslations[lang][level] || level
}

// 创建日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const translatedLevel = translateLogLevel(level)
    return `[${timestamp}] [${translatedLevel}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
  })
)

// 创建日志记录器
export const logger = winston.createLogger({
  format: logFormat,
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.join(__dirname, '../../logs/error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d'
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(__dirname, '../../logs/combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d'
      // level: 'debug' // Removed to revert to default
    })
  ]
})

// 在开发环境下添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: logFormat // Keep existing format
    // level: 'debug' // Removed to revert to default
  }))
}

// 导出日志函数
export const logInfo = (message, meta = {}) => {
  logger.info(message, meta)
}

export const logError = (message, error = null) => {
  logger.error(message, { error: error?.message || error })
}

export const logWarning = (message, meta = {}) => {
  logger.warn(message, meta)
}

export const logDebug = (message, meta = {}) => {
  logger.debug(message, meta)
}

export const logSecurity = (message, meta = {}) => {
  logger.info(`[Security] ${message}`, meta)
}

export const logBusiness = (message, meta = {}) => {
  logger.info(`[Business] ${message}`, meta)
}

// 性能日志
export const logPerformance = (operation, startTime) => {
  const duration = Date.now() - startTime
  logger.debug('性能监控', {
    operation,
    duration,
    timestamp: new Date().toISOString()
  })
}

// 系统资源日志
export const logSystemResources = () => {
  const used = process.memoryUsage()
  logger.debug('系统资源使用情况', {
    rss: Math.round(used.rss / 1024 / 1024),
    heapTotal: Math.round(used.heapTotal / 1024 / 1024),
    heapUsed: Math.round(used.heapUsed / 1024 / 1024),
    external: Math.round(used.external / 1024 / 1024),
    timestamp: new Date().toISOString()
  })
}

// 请求日志中间件
export const requestLogger = (req, res, next) => {
  const start = Date.now()
  const requestId = Math.random().toString(36).substring(7)
  
  // 只记录 API 请求
  if (req.originalUrl.startsWith('/api/')) {
    logger.http('API请求', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      contentLength: req.headers['content-length'],
      timestamp: new Date().toISOString()
    })
  }
  
  res.on('finish', () => {
    const duration = Date.now() - start
    // 只记录 API 请求
    if (req.originalUrl.startsWith('/api/')) {
      logger.http('API响应', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString()
      })
    }
  })
  
  next()
} 