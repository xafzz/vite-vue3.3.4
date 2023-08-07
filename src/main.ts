// @ts-ignore
import { compile, createApp, parse } from 'vue';
// @ts-ignore
import App from './App.vue'

console.log(`main->render()`,App);

const app = createApp(App, {
    name: 'ddd'
})
app.mount('#app')


// 运行时 编译
// const rootComponent = compile(SFC, {
//     mode: 'module', // import export 模式
//     sourceMap: true, // 生成sourceMap
//     inline: false, // true的时候 preamble 跟 code 分开，false 合在一起
//     // 从脚本分析的可选绑定元数据-用于优化
//     // 启用“prefixIdentifiers”时的绑定访问
//     bindingMetadata: {
//         __isScriptSetup: true
//     },
//     hoistStatic: true,
//     scopeId:22222,
//     delimiters: undefined,
//     isCustomElement: undefined
// })