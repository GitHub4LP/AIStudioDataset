import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

export const useCookieStore = defineStore('cookie', () => {
  const cookie = ref('');
  const isReady = ref(false);
  const isAIStudio = computed(() => {
    return window.location.hostname.endsWith('.baidu.com');
  });

  // 从当前环境获取cookie
  async function getCookieFromEnvironment() {
    if (isAIStudio.value) {
      // 在AIStudio环境中，直接从document.cookie获取
      const cookies = document.cookie.split(';');
      const baiduCookie = cookies.find(c => c.trim().startsWith('BAIDUID='));
      if (baiduCookie) {
        cookie.value = baiduCookie.trim();
        return true;
      }
    }
    return false;
  }

  // 检查后端cookie状态
  async function checkBackendCookieStatus() {
    try {
      const response = await axios.get('/api/datasets/cookie/status');
      return response.data.hasCookie;
    } catch (error) {
      console.error('检查后端cookie状态失败:', error);
      return false;
    }
  }

  // 设置cookie到后端
  async function setCookieToBackend(newCookie) {
    try {
      const response = await axios.post('/api/datasets/cookie', { cookie: newCookie });
      if (response.data.success) {
        cookie.value = newCookie;
        isReady.value = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('设置cookie到后端失败:', error);
      return false;
    }
  }

  // 初始化cookie
  async function initializeCookie() {
    // 1. 尝试从环境获取
    if (await getCookieFromEnvironment()) {
      const success = await setCookieToBackend(cookie.value);
      if (success) {
        isReady.value = true;
        return true;
      }
    }

    // 2. 检查后端是否已有cookie
    if (await checkBackendCookieStatus()) {
      isReady.value = true;
      return true;
    }

    // 3. 如果都没有，返回false表示需要手动输入
    isReady.value = false;
    return false;
  }

  return {
    cookie,
    isReady,
    isAIStudio,
    initializeCookie,
    setCookieToBackend,
    getCookieFromEnvironment
  };
}); 