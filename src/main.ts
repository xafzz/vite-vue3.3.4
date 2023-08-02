// @ts-ignore
import { compile } from 'vue';
// @ts-ignore
import SFC from './App.vue'

const render = compile(SFC, {
    delimiters: undefined,
    isCustomElement: undefined
})

// const app = createApp(SFC, {
//     name: 'ddd'
// })
// app.mount('#app')
console.log(`结果：`, render);
