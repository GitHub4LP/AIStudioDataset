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
  history: createWebHistory('./'), // 使用相对路径作为基础路径
  routes
})

export default router 