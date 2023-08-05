// @ts-ignore
import { compile } from 'vue';
// @ts-ignore
import SFC from './App.vue'

// 没用vite 直接将文件内容返回
const render = compile(SFC, {
    delimiters: undefined,
    isCustomElement: undefined
})

// const app = createApp(SFC, {
//     name: 'ddd'
// })
// app.mount('#app')
console.log(`结果：`, render);
