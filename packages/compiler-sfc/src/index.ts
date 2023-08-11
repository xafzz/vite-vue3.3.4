import { print, extend } from '@vue/shared'
import { compile } from '@vue/compiler-dom';
import { parse } from './parse'

const filename = 'compiler-sfc/index.ts'

export function sfc(template, options) {
    const { descriptor, errors } = parse(template)
    const result = compile(descriptor.template.content, extend({}, options, {
        mode: 'module', // import export 模式
        sourceMap: true, // 生成sourceMap
        inline: false, // true的时候 preamble 跟 code 分开，false 合在一起
        prefixIdentifiers:true,
        hoistStatic:true,
        // 从脚本分析的可选绑定元数据-用于优化
        // 启用“prefixIdentifiers”时的绑定访问
        bindingMetadata: {
            __isScriptSetup: true
        },
        delimiters: undefined,
        isCustomElement: undefined
    }))

    return {
        ...descriptor,
        ...result,
        code: result.code.replace(
            /\nexport (function|const) (render|ssrRender)/,
            "\n$1 _sfc_$2"
        )
    }
}

export  { parse }