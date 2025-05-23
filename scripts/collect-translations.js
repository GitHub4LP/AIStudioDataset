import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 翻译收集器
class TranslationCollector {
  constructor() {
    this.translations = new Map()
    this.sourceFiles = new Set()
  }

  // 添加翻译
  addTranslation(key, text, sourceFile) {
    if (!this.translations.has(key)) {
      this.translations.set(key, {
        text,
        sourceFiles: new Set()
      })
    }
    this.translations.get(key).sourceFiles.add(sourceFile)
    this.sourceFiles.add(sourceFile)
  }

  // 生成翻译文件
  generateTranslationFiles() {
    const baseDir = path.join(__dirname, '../src/i18n/locales')
    
    // 确保目录存在
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }

    // 生成中文翻译文件
    const zhTranslations = {}
    this.translations.forEach((value, key) => {
      zhTranslations[key] = value.text
    })
    fs.writeFileSync(
      path.join(baseDir, 'zh-CN.js'),
      `export default ${JSON.stringify(zhTranslations, null, 2)}`
    )

    // 生成英文翻译文件（使用相同的键，但文本为空）
    const enTranslations = {}
    this.translations.forEach((value, key) => {
      enTranslations[key] = ''
    })
    fs.writeFileSync(
      path.join(baseDir, 'en-US.js'),
      `export default ${JSON.stringify(enTranslations, null, 2)}`
    )

    // 生成翻译报告
    this.generateReport()
  }

  // 生成翻译报告
  generateReport() {
    const report = {
      totalTranslations: this.translations.size,
      sourceFiles: Array.from(this.sourceFiles),
      translations: Array.from(this.translations.entries()).map(([key, value]) => ({
        key,
        text: value.text,
        sourceFiles: Array.from(value.sourceFiles)
      }))
    }

    fs.writeFileSync(
      path.join(__dirname, '../translation-report.json'),
      JSON.stringify(report, null, 2)
    )
  }
}

// 创建收集器实例
const collector = new TranslationCollector()

// 导出收集器
export default collector 