<template>
  <el-dropdown @command="handleLanguageChange" trigger="click">
    <span class="language-switcher">
      {{ currentLanguage }}
      <el-icon class="el-icon--right"><arrow-down /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="zh-CN">中文</el-dropdown-item>
        <el-dropdown-item command="en-US">English</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown } from '@element-plus/icons-vue'

const { locale } = useI18n()

const currentLanguage = computed(() => {
  return locale.value === 'zh-CN' ? '中文' : 'English'
})

const handleLanguageChange = (lang) => {
  locale.value = lang
  localStorage.setItem('language', lang)
}
</script>

<style scoped>
.language-switcher {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--el-text-color-primary);
  padding: 0 12px;
  height: 32px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.language-switcher:hover {
  background-color: var(--el-fill-color-light);
}
</style> 