// @ts-ignore
import { createApp, compile, parse } from 'vue';
// @ts-ignore
import App from './App.vue'

// console.log(`main->render()`,App);

const app = createApp(App)
app.mount('#app')

console.log(``,3213,app._container);

// runtime-compile  调试
// @vitejs/plugin-vue 
// const { descriptor, errors } = parse(App)
// // 运行时 编译
// const rootComponent = compile(descriptor.template.content, {
//     mode: 'module', // import export 模式
//     sourceMap: true, // 生成sourceMap
//     inline: false, // true的时候 preamble 跟 code 分开，false 合在一起
//     prefixIdentifiers: true,
//     hoistStatic: true,
//     // 从脚本分析的可选绑定元数据-用于优化
//     // 启用“prefixIdentifiers”时的绑定访问
//     bindingMetadata: {
//         __isScriptSetup: true
//     },
//     delimiters: undefined,
//     isCustomElement: undefined
// })

// console.log(rootComponent.code);