<template>
  <el-tooltip :content="tooltipText" placement="bottom">
    <div class="theme-switcher" @click="handleThemeToggle">
      <el-icon v-if="isDarkTheme"><Sunny /></el-icon>
      <el-icon v-else><Moon /></el-icon>
      <span class="theme-text">{{ currentThemeText }}</span>
    </div>
  </el-tooltip>
</template>

<script setup>
import { computed } from 'vue'
import { useUIStore } from '../stores/uiStore'
import { useI18n } from 'vue-i18n'
import { Sunny, Moon } from '@element-plus/icons-vue'

const { t } = useI18n()
const uiStore = useUIStore()

const isDarkTheme = computed(() => uiStore.isDarkTheme)
const themeMode = computed(() => uiStore.themeMode)
const systemTheme = computed(() => uiStore.systemTheme)

const currentThemeText = computed(() => {
  if (themeMode.value === 'system') {
    return t('theme.auto')
  }
  return isDarkTheme.value ? t('theme.dark') : t('theme.light')
})

const tooltipText = computed(() => {
  if (themeMode.value === 'system') {
    return t('theme.systemIs', { theme: systemTheme.value === 'dark' ? t('theme.dark') : t('theme.light') })
  }
  return t('theme.switchTheme')
})

const handleThemeToggle = () => {
  uiStore.toggleTheme()
}
</script>

<style scoped>
.theme-switcher {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
  padding: 0 12px;
  height: 32px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.theme-switcher:hover {
  background-color: var(--el-fill-color-light);
}

.theme-switcher .el-icon {
  font-size: 18px;
}

.theme-text {
  font-size: 14px;
}
</style> 