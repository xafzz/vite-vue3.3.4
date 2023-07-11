import { print } from '@vue/shared'
import * as CompilerDom from '@vue/compiler-dom'
import { createCache } from './cache'
import { NodeTypes } from '@vue/compiler-core'
import { TextModes } from 'packages/compiler-core/src/parse'
import { SourceMapGenerator } from 'source-map-js'
import { parseCssVars } from './style/cssVars'

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
        // parseElement 获取 element 的mode
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
                console.log(print(currentFilename, 'getTextMode()', `2->${tag}`), props);
                return TextModes.RAWTEXT
            } else {
                console.log(print(currentFilename, 'getTextMode()', `0->${tag}`));
                return TextModes.DATA
            }

        },
        onError: (e: SyntaxError) => {
            errors.push(e)
        }
    })

    ast.children.forEach(node => {
        // 节点元素
        if (node.type !== NodeTypes.ELEMENT) return
        // 只保留不为空的节点（当template不是模板时)
        if (ignoreEmpty && node.tag !== 'template' && isEmpty(node) && !hasSrc(node)) return

        // 包含了所有的内容
        switch (node.tag) {
            case 'template':
                // 上面刚声明的 null
                if (!descriptor.template) {
                    const templateBlock = (descriptor.template = createBlock(
                        node,
                        source,
                        false
                    ))
                    templateBlock.ast = node

                    // 2.x 警告 <template functional>
                    if (templateBlock.attrs.functional) {
                        const err = new SyntaxError(
                            `Vue3 中不再支持<template functional>,
                            因为 functional components 不在具有显著性能
                            只需使用普通的<template>`
                        ) as any
                        err.loc = node.props.find(n => n.name === 'functional')!.loc
                        errors.push(err)
                    }
                } else {
                    errors.push(createDuplicateBlockError(node))
                }
                break;
            case 'script':
                const scriptBlock = createBlock(node, source, pad) as any
                const isSetup = !!scriptBlock.attrs.setup
                if (isSetup && !descriptor.scriptSetup) {
                    descriptor.scriptSetup = scriptBlock
                    break
                }
                if (!isSetup && !descriptor.script) {
                    descriptor.script = scriptBlock
                    break
                }
                errors.push(createDuplicateBlockError(node, isSetup))
                break;
            case 'style':
                const styleBlock = createBlock(node, source, pad) as any
                if (styleBlock.attrs.vars) {
                    errors.push(
                        new SyntaxError(
                            `<style vars> 被新提案取代: ` +
                            `https://github.com/vuejs/rfcs/pull/231`
                        )
                    )
                }
                descriptor.styles.push(styleBlock)
                break;

            default:
                descriptor.customBlocks.push(createBlock(node, source, pad))
                break;
        }
    })

    if (!descriptor.template && !descriptor.script && !descriptor.scriptSetup) {
        errors.push(
            new SyntaxError(`单个文件组件中至少需要一个＜template＞或＜script＞`)
        )
    }
    // setup
    if (descriptor.scriptSetup) {
        if (descriptor.scriptSetup.src) {
            errors.push(
                new SyntaxError(`<script setup> 无法使用'src'属性，因为他的语法在组件之外是不明确的`)
            )
            descriptor.scriptSetup = null
        }
        if (descriptor.script && descriptor.script.src) {
            errors.push(
                new SyntaxError(`有<script setup>，不能使用<script>的'src'属性,因为要一起处理`)
            )
            descriptor.script = null
        }
    }

    // 生成sourceMap
    if (sourceMap) {
        const genMap = block => {
            if (block && !block.src) {
                block.map = generateSourceMap(
                    filename,
                    source,
                    block.content,
                    sourceRoot,
                    !pad || block.type === 'template' ? block.loc.start.line - 1 : 0
                )
            }
        }
        genMap(descriptor.template)
        genMap(descriptor.script)
        descriptor.styles.forEach(genMap)
        descriptor.customBlocks.forEach(genMap)
    }

    // 先把'/* */'注释去掉，解析css变量：'v-bind'
    descriptor.cssVars = parseCssVars(descriptor)

    // 是否有插槽选择器 :slotted(div)
    const slottedRE = /(?:::v-|:)slotted\(/
    descriptor.slotted = descriptor.styles.some(
        style => style.scoped && slottedRE.test(style.content)
    )

    const result = {
        descriptor,
        errors
    }
    // 写入缓存
    parseCache.set(sourceKey, result)
    console.log(print(currentFilename, 'current'), result);
    return result
}

export function hmrShouldReload(
    prevImports,
    next
): boolean {
    console.error(324234, print(currentFilename, 'hmrShouldReload()'), prevImports, next);
    
    return false
}

// 如果节点没有子级，则返回true
// 过滤掉空的文本节点（trim的内容）。
function isEmpty(node) {
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children
        if (child.type !== NodeTypes.TEXT || child.content.trim() !== '') {
            return false
        }
    }
    return true
}

function hasSrc(node) {
    const result = node.props.some(p => {
        // 不是 属性节点 type
        if (p.type !== NodeTypes.ATTRIBUTE) {
            return false
        }
        // 是否有 src
        return p.name === 'src'
    })
    // console.log(print(currentFilename, 'hasSrc()',`${node.tag}`),result);
    return result
}

function createDuplicateBlockError(node, isScriptSetup = false) {
    const err = new SyntaxError(
        `单文件组件只能包含一个<${node.tag}${isScriptSetup ? ` setup` : ``}`
    ) as any
    err.loc = node.loc
    return err
}

function createBlock(
    node,
    source,
    pad
) {
    const type = node.tag
    // 拿到templte的坐标
    let { start, end } = node.loc
    let content = ''
    if (node.children.length) {
        // template 标签内的
        start = node.children[0].loc.start
        // 最后一个结束
        end = node.children[node.children.length - 1].loc.end
        content = source.slice(start.offset, end.offset)
    } else {
        const offset = node.loc.source.indexOf(`</`)
        if (offset > -1) {
            start = {
                line: start.line,
                column: start.column + offset,
                offset: start.offset + offset
            }
        }
        end = { ...start }
    }
    // template 内容及坐标
    const loc = { source: content, start, end }
    const attrs: Record<string, string | true> = {}
    const block: any = { type, content, loc, attrs }

    if (pad) {
        console.error('什么时候为true');
    }
    // <template lang="pug"
    // <script lang="ts" setup
    // <style lang="less" scoped
    node.props.forEach(n => {
        if (n.type === NodeTypes.ATTRIBUTE) {
            attrs[n.name] = n.value ? n.value.content || true : true
            if (n.name === 'lang') {
                block.lang = n.value && n.value.content
            } else if (n.name === 'src') {
                block.src = n.value && n.value.content
            } //style
            else if (type === 'style') {
                if (n.name === 'scoped') {
                    block.scoped = true
                } else if (n.name === 'module') {
                    block.module = attrs[n.name]
                }
            } // script
            else if (type === 'script' && n.name === 'setup') {
                block.setup = attrs.setup
            }
        }
    })
    console.log(print(currentFilename, 'createBlock', `${block.type}`), block);
    return block
}

const splitRE = /\r?\n/g
const emptyRE = /^(?:\/\/)?\s*$/

// 生成sourceMap
function generateSourceMap(
    filename: string,
    source: string,
    generated: string,
    sourceRoot: string,
    lineOffset: number
) {
    const map = new SourceMapGenerator({
        file: filename.replace(/\\/g, '/'),
        sourceRoot: sourceRoot.replace(/\\/g, '/')
    })
    map.setSourceContent(filename, source)
    generated.split(splitRE).forEach((line, index) => {
        if (!emptyRE.test(line)) {
            const originalLine = index + 1 + lineOffset
            const generatedLine = index + 1
            for (let i = 0; i < line.length; i++) {
                if (!/\s/.test(line[i])) {
                    map.addMapping({
                        source: filename,
                        original: {
                            line: originalLine,
                            column: i
                        },
                        generated: {
                            line: generatedLine,
                            column: i
                        }
                    })
                }
            }
        }
    })

    const result = JSON.parse(map.toString())
    console.log(print(currentFilename, 'generateSourceMap'), result);
    return result
}
