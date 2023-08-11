export const version = __VERSION__

export { createRenderer } from './renderer'

// 用于运行时编译器
export { registerRuntimeCompiler, isRuntimeOnly } from './component'

export { Fragment, createElementBlock, createElementVNode, openBlock } from './vnode'

// should sync with '@vue/compiler-core/src/runtimeHelpers.ts'
export {
    popScopeId,
    pushScopeId
} from './componentRenderContext'

export * from './errorHandling'

export {
    resolveComponent,
    resolveDirective,
    resolveDynamicComponent
} from './helpers/resolveAssets'

import { resolveFilter as _resolveFilter } from './helpers/resolveAssets'

export { DeprecationTypes } from './compat/compatConfig'

import {
    warnDeprecation,
    isCompatEnabled,
    checkCompatEnabled,
    softAssertCompatEnabled
} from './compat/compatConfig'
import { createCompatVue } from './compat/global'
/**
 * @internal only exposed in compat builds
 */
export const resolveFilter = __COMPAT__ ? _resolveFilter : null

const _compatUtils = {
    warnDeprecation,
    createCompatVue,
    isCompatEnabled,
    checkCompatEnabled,
    softAssertCompatEnabled
}

/**
 * @internal only exposed in compat builds.
 */
export const compatUtils = (
    __COMPAT__ ? _compatUtils : null
) as typeof _compatUtils
