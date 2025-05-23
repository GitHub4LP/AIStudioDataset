import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUIStore = defineStore('ui', () => {
  // 主题状态：'system' 或 'manual'
  const themeMode = ref(localStorage.getItem('themeMode') || 'system');
  // 手动主题：'light' 或 'dark'
  const manualTheme = ref(localStorage.getItem('manualTheme') || 'light');
  // 系统主题
  const systemTheme = ref(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    systemTheme.value = e.matches ? 'dark' : 'light';
    if (themeMode.value === 'system') {
      document.documentElement.setAttribute('data-theme', systemTheme.value);
    }
  });

  // 当前实际使用的主题
  const currentTheme = computed(() => {
    return themeMode.value === 'system' ? systemTheme.value : manualTheme.value;
  });

  // 是否为深色主题
  const isDarkTheme = computed(() => currentTheme.value === 'dark');

  // 切换主题模式
  const toggleTheme = () => {
    if (themeMode.value === 'system') {
      // 从系统模式切换到手动模式，使用当前系统主题的反色
      themeMode.value = 'manual';
      manualTheme.value = systemTheme.value === 'dark' ? 'light' : 'dark';
    } else {
      // 从手动模式切换回系统模式
      themeMode.value = 'system';
    }
    
    // 保存设置
    localStorage.setItem('themeMode', themeMode.value);
    localStorage.setItem('manualTheme', manualTheme.value);
    
    // 应用主题
    document.documentElement.setAttribute('data-theme', currentTheme.value);
  };

  // 初始化主题
  const initTheme = () => {
    document.documentElement.setAttribute('data-theme', currentTheme.value);
  };

  const selectedExplorerItem = ref(null);

  const selectExplorerItem = (item) => {
    selectedExplorerItem.value = item;
  };

  const clearSelectedExplorerItem = () => {
    selectedExplorerItem.value = null;
  };

  return {
    themeMode,
    manualTheme,
    systemTheme,
    currentTheme,
    isDarkTheme,
    toggleTheme,
    initTheme,
    selectedExplorerItem,
    selectExplorerItem,
    clearSelectedExplorerItem
  };
});
