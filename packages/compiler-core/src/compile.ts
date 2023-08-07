import { extend, isString, print } from "@vue/shared"
import { ErrorCodes, createCompilerError, defaultOnError } from "./errors"
import { transformOnce } from "./transforms/vOnce"
import { transformIf } from "./transforms/vIf"
import { transformMemo } from "./transforms/vMemo"
import { transformFor } from "./transforms/vFor"
import { transformFilter } from "./compat/transformFilter"
import { trackSlotScopes, trackVForSlotScopes } from "./transforms/vSlot"
import { transformExpression } from "./transforms/transformExpression"
import { transformSlotOutlet } from "./transforms/transformSlotOutlet"
import { transformElement } from "./transforms/transformElement"
import { transformText } from "./transforms/transformText"
import { transformOn } from "./transforms/vOn"
import { transformBind } from "./transforms/vBind"
import { transformModel } from "./transforms/vModel"
import { transform } from "./transform"
import { baseParse } from "./parse"
import { generate } from "./codegen"


const currentFilename = 'compiler-core/compile.ts'


// 我们将其命名为 `baseCompile` ，这样高阶编译器
// @vue/compiler-dom 可以导出`compile`，同时重新导出其他所有内容

// 模板字符串 template 的解析，将 template 解析成 AST
// AST 转换
// 代码生成

/**
    为什么 Vue 不直接将 template 转换为 vnode？而是先生成 render code 函数在通过 render code 函数来生成 vnode

     Vue 中当状态发生改变之后，需要重渲染视图，而 vnode 是无法获取到最新的状态。
     所以需要一个运行时的执行器，来保证重渲染视图时，vnode 每次能拿到最新的状态。
     而 render code 函数本质上是一个可以执行的函数，能满足动态性，获取到最新的状态
 */
export function baseCompile(
    template: string | any,
    options: any = {}
) {

    const onError = options.onError || defaultOnError
    const isModuleMode = options.mode === 'module'

    // node 端 编译
    // if (__BROWSER__) {
    //     if (options.prefixIdentifiers === true) {
    //         onError(createCompilerError(ErrorCodes.X_PREFIX_ID_NOT_SUPPORTED))
    //     } else if (isModuleMode) {
    //         onError(createCompilerError(ErrorCodes.X_MODULE_MODE_NOT_SUPPORTED))
    //     }
    // }

    const prefixIdentifiers = (options.prefixIdentifiers === true || isModuleMode) // !__BROWSER__ && 

    // node 端 编译
    // if (!prefixIdentifiers && options.cacheHandlers) {
    //     onError(createCompilerError(ErrorCodes.X_CACHE_HANDLER_NOT_SUPPORTED))
    // }
    // if (options.scopeId && !isModuleMode) {
    //     onError(createCompilerError(ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED))
    // }

    // 解析template 生成 ast
    const ast = isString(template) ? baseParse(template, options) : template
    // 获取节点和指令转换的方法
    const [nodeTransforms, directiveTransforms] = getBaseTransformPreset(prefixIdentifiers)

    if (options.isTS) {
        console.error(`options.isTS`,);
    }

    /**
     * 将template ast转换成JavaScript AST
     * 1、traverseNode  遍历所有的节点转换函数
     *    ignoreSideEffectTags
     *    transformStyle
     *    warnTransitionChildren
     *    transformOnce
     *    transformIf
     *    transformFor
     *    transformExpression
     *    transformSlotOutlet
     *    transformElement
     *    trackSlotScopes
     *    transformText
     * 2、hoistStatic
     *   通过 walk 递归循环 ast 节点
     *   在 codegenNode 
     *   存在纯静态标签 添加 hoisted 对象，并将静态 patchFlag 标记为 -1
     *   存在指令 设置 dynamicProps 对象，如：@click="click" 转为 onclick
     *   存在属性静态 在 props内添加 hoisted 对象
     * 3、createRootCodegen
     * 设置 root 下 codegenNode 
     */
    transform(
        ast,
        extend({}, options, {
            prefixIdentifiers,
            nodeTransforms: [
                ...nodeTransforms,
                ...(options.nodeTransforms || []) // user transforms
            ],
            directiveTransforms: extend(
                {},
                directiveTransforms,
                options.directiveTransforms || {} // user transforms
            )
        })
    )
    return generate(
        ast,
        extend({}, options, {
            prefixIdentifiers
        })
    )
}

// 预先整合需要用于转换的辅助函数
// 插件化架构
export function getBaseTransformPreset(prefixIdentifiers?: boolean): any {
    const result = [
        [
            transformOnce,  // v-once
            transformIf,    // v-if
            transformMemo,  // v-memo
            transformFor,   // v-for
            ...(__COMPAT__ ? [transformFilter] : []), // v2

            trackVForSlotScopes,
            transformExpression,

            transformSlotOutlet,
            transformElement,
            trackSlotScopes,
            transformText
        ],
        {
            on: transformOn,
            bind: transformBind,
            model: transformModel
        }
    ]
    console.log(print(currentFilename, 'getBaseTransformPreset()', '插件化架构'), result)
    return result
}