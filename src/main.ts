import { createApp } from "@vue/runtime-dom";
import SFC from './compiler-sfc.vue'

const app = createApp(SFC, {
    name: 'ddd'
})
app.mount('#app')
console.log(`结果：`,app);
