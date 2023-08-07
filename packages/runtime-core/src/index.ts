export const version = __VERSION__

export { createRenderer } from './renderer'

// 用于运行时编译器
export { registerRuntimeCompiler, isRuntimeOnly } from './components'


export { Fragment, createElementBlock, createElementVNode, openBlock } from './vnode'

// should sync with '@vue/compiler-core/src/runtimeHelpers.ts'
export {
    popScopeId,
    pushScopeId
} from './componentRenderContext'