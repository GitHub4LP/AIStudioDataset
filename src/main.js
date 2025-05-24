import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createPinia } from 'pinia'
import router from './router'

const app = createApp(App)
app.use(i18n)
app.use(ElementPlus)
app.use(createPinia())
app.use(router)
app.mount('#app')