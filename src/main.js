import { createApp } from 'vue'
import { createPinia } from 'pinia' // Import Pinia
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

const pinia = createPinia() // Create Pinia instance
const app = createApp(App)

app.use(pinia) // Use Pinia
app.use(ElementPlus)
app.mount('#app')