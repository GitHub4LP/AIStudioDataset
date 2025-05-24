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
  // Use window.SUBPATH if available (set by sw_loader.js), otherwise default to '/'
  history: createWebHistory(window.SUBPATH || '/'), 
  routes
})

export default router 