import i18n from '../i18n'

const { t } = i18n.global

export const translateLog = (key, params = {}) => {
  return t(`log.${key}`, params)
}

export const translateError = (key, params = {}) => {
  return t(`error.${key}`, params)
}

export const translateMessage = (key, params = {}) => {
  return t(key, params)
}

// 用于收集需要翻译的文本
export const collectTranslation = (key, text) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Translation] ${key}: ${text}`)
  }
} 