import { print } from '@vue/shared'
import * as CompilerDom from '@vue/compiler-dom'
import { createCache } from './cache'
import { NodeTypes } from '@vue/compiler-core'
import { TextModes } from 'packages/compiler-core/src/parse'


const currentFilename = 'compiler-sfc/parse.ts'

export const DEFAULT_FILENAME = 'anonymous.vue'

export function parse(
    source: string,
    {
        sourceMap = true,
        filename = DEFAULT_FILENAME,
        sourceRoot = '',
        pad = false,
        ignoreEmpty = true,
        compiler = CompilerDom
    } = {}
) {
    console.log(print(currentFilename, 'parse()'));

    const sourceKey = source + sourceMap + filename + sourceRoot + pad + compiler.parse

    // 拿进来
    const parseCache = createCache()
    const cache = parseCache.get(sourceKey)
    if (cache) {
        console.log(print(currentFilename, 'parse(),cache里面有值了'));
        return cache
    }
    const descriptor = {
        filename,
        source,
        template: null,
        script: null,
        scriptSetup: null,
        styles: [],
        customBlocks: [],
        cssVars: [],
        slotted: false,
        shouldForceReload: prevImports => hmrShouldReload(prevImports, descriptor)
    }

    const errors: (SyntaxError)[] = []

    const ast = compiler.parse(source, {
        // 没有SFC解析级别的组件
        isNativeTag: () => true,
        isPreTag: () => true,
        getTextMode: ({ tag, props }, parent) => {
            if (
                (!parent && tag !== 'template') ||
                (
                    tag === 'template' &&
                    // 有一个条件满足 class
                    props.some(p => {
                        return p.type === NodeTypes.ATTRIBUTE &&
                            p.name === 'lang' &&
                            p.value &&
                            p.value.content &&
                            p.value.content !== 'html'
                    })
                )
            ) {
                console.log(print(currentFilename, 'getTextMode()',`2->${tag}`),props);
                return TextModes.RAWTEXT
            } else { 
                console.log(print(currentFilename, 'getTextMode()',`0->${tag}`));
                return TextModes.DATA
            }

        },
        onError: (e: SyntaxError) => {
            errors.push(e)
        }
    })
    console.log(print(currentFilename, 'current'), ast);

    return source
}

export function hmrShouldReload(
    prevImports,
    next
): boolean {
    console.log(print(currentFilename, 'hmrShouldReload()'),prevImports, next);


    return false
}