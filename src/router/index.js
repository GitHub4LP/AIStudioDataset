import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: App
  }
]

const router = createRouter({
  history: createWebHistory(), // 使用空字符串，让 Vue Router 自动处理相对路径
  routes
})

export default router 