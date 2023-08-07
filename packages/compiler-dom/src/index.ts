
import { extend, print } from "@vue/shared"
import { baseCompile, baseParse } from "@vue/compiler-core"
import { parserOptions } from "./parserOptions"
import { ignoreSideEffectTags } from "./transforms/ignoreSideEffectTags"
import { transformStyle } from "./transforms/transformStyle"
import { transformTransition } from "./transforms/Transition"
import { noopDirectiveTransform } from "./transforms/noopDirectiveTransform"
import { transformVHtml } from "./transforms/vHtml"
import { transformVText } from "./transforms/vText"
import { transformModel } from "./transforms/vModel"
import { transformOn } from "./transforms/vOn"
import { transformShow } from "./transforms/vShow"
import { stringifyStatic } from "./transforms/stringifyStatic"




const currentFilename = 'compiler-dom/index.ts'


export const DOMNodeTransforms = [
    transformStyle, //行内样式
    ...(__DEV__ ? [transformTransition] : [])
]

export const DOMDirectiveTransforms: Record<string, any> = {
    cloak: noopDirectiveTransform, // v-cloak
    html: transformVHtml, // v-html
    text: transformVText, // v-text
    model: transformModel, // v-model override compiler-core
    on: transformOn, // v-on override compiler-core
    show: transformShow // v-show
  }

export function compile(template: string, options:any = {}) {
    // 合并 options
    return baseCompile(
        template,
        extend({}, parserOptions, options, {
            // 节点
            nodeTransforms: [
                // 忽略 <script> 和 <tag>.
                // 此项不放在 DOMNodeTransforms 中，因为该列表会被 compiler-ssr
                // compiler-ssr 用于生成 vnode 回退分支
                ignoreSideEffectTags, // 先移除副作用标签 sfc模式下 将.vue整个内容
                ...DOMNodeTransforms, // 准备转换节点
                ...(options.nodeTransforms || [])
            ],
            // 指令
            directiveTransforms: extend(
                {},
                DOMDirectiveTransforms,
                options.directiveTransforms || {}
            ),
            // 静态提升
            transformHoist: __BROWSER__ ? null : stringifyStatic
        })
    )
}

export function parse(template: string, options: any = {}) {

    const result = baseParse(
        template,
        extend(
            {},
            parserOptions,
            options
        )
    )
    console.log(print(currentFilename, 'compoiler-dom-parse()'), result)
    return result
}