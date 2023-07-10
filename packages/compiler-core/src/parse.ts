import { NO, extend, isArray, print } from "@vue/shared"
import { ConstantTypes, ElementTypes, Namespaces, NodeTypes, createRoot } from "./ast"
import { ErrorCodes, createCompilerError, defaultOnError, defaultOnWarn } from "./errors"
import { advancePositionWithClone, advancePositionWithMutation, assert, isCoreComponent } from "./utils"
import { CompilerDeprecationTypes, checkCompatEnabled, isCompatEnabled, warnDeprecation } from "./compat/compatConfig"
import { makeMap } from "packages/shared/src/makeMap"

const currentFilename = 'compiler-core/parse.ts'

export function baseParse(
    content: string,
    options: {}
): any {

    console.log(print(currentFilename, 'baseParse()'), content, options)

    const context = createParserContext(content, options)
    const start = getCursor(context)
    return createRoot(
        parseChildren(context, TextModes.DATA, []),
        getSelection(context, start)
    )
}

function createParserContext(
    content: string,
    rawOptions: any
) {
    console.log(print(currentFilename, 'createParserContext()'), defaultParserOptions)

    const options = extend({}, defaultParserOptions)

    for (let key in rawOptions) {
        options[key] =
            rawOptions[key] === undefined
                ? defaultParserOptions[key]
                : rawOptions[key]
    }

    return {
        options,
        column: 1,
        line: 1, //行
        offset: 0, //偏移量
        originalSource: content,
        source: content, //
        inPre: false,
        inVPre: false, //v-pre
        onWarn: options.onWarn
    }
}

const decodeRE = /&(gt|lt|amp|apos|quot);/g
const decodeMap: Record<string, string> = {
    gt: '>',
    lt: '<',
    amp: '&',
    apos: "'",
    quot: '"'
}

// 默认上下文属性
export const defaultParserOptions = {
    delimiters: [`{{`, `}}`],
    getNamespace: () => Namespaces.HTML,
    getTextMode: () => TextModes.DATA,
    isVoidTag: NO,
    isPreTag: NO,
    isCustomElement: NO, //自定义元素名称 始终是false
    decodeEntities: (rawText: string): string => rawText.replace( //实体解码
        decodeRE, (_, p1) => decodeMap[p1]
    ),
    onError: defaultOnError,
    onWarn: defaultOnWarn,
    commits: __DEV__
}

export const enum TextModes {
    DATA, // mode = 0 ：类型即为元素（包括组件）
    RCDATA, // mode = 1 ：是在<textarea>标签中的文本
    RAWTEXT, // mode = 2 ：类型为script、noscript、iframe、style中的代码,是不是也有div，span？
    CDATA, // mode = 3 ：前端比较少接触的'<![CDATA[cdata]]>'代码，这是使用于XML与XHTML中的注释，在该注释中的 cdata 代码将不会被解析器解析，而会当做普通文本处理;
    ATTRIBUTE_VALUE //mode = 4 ：各个标签的属性；
}

function getCursor(context) {

    const { column, line, offset } = context
    console.log(print(currentFilename, 'getCursor()'), { column, line, offset })
    return {
        column, //这一行的第几个字符
        line, //第几行
        offset //从开头到现在隔了多少个字符，包括空格
    }
}

// 编译子标签
function parseChildren(
    context,
    mode,
    ancestors
) {

    // <div>xx</div> 循环第一次的时候，xx的parent就是div
    const parent = last(ancestors)
    // 0
    const ns = parent ? parent.ns : Namespaces.HTML
    const nodes = []

    while (!isEnd(context, mode, ancestors)) {

        __TEST__ && assert(context.source.length > 0)
        const s = context.source
        let node = undefined

        if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
            // 不是 v-pre 并且 存在 {{
            if (!context.inVPre && startsWith(s, context.options.delimiters[0])) {
                // 生成动态数据节点 {{ 
                node = parseInterpolation(context, mode)
            } else if (mode === TextModes.DATA && s[0] === '<') {
                // 只有一个<
                if (s.length === 1) {
                    emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 1)
                } else if (s[1] === '!') {
                    if (startsWith(s, '<!--')) {
                        node = parseComment(context)
                    } else if (startsWith(s, '<!DOCTYPE')) {
                        node = parseBogusComment(context)
                    } else if (startsWith(s, '<![CDATA[')) {


                        if (ns !== Namespaces.HTML) {
                            node = parseCDATA(context, ancestors)
                        } else {
                            emitError(context, ErrorCodes.CDATA_IN_HTML_CONTENT)
                            node = parseBogusComment(context)
                        }

                    } else {
                        emitError(context, ErrorCodes.INCORRECTLY_OPENED_COMMENT)
                        node = parseBogusComment(context)
                    }
                } else if (s[1] === '/') {
                    if (s.length === 2) {
                        emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 2)
                    } else if (s[2] === '>') {
                        emitError(context, ErrorCodes.MISSING_END_TAG_NAME, 2)
                        advanceBy(context, 3)
                        continue
                    } else if (/[a-z]/i.test(s[2])) {
                        emitError(context, ErrorCodes.X_INVALID_END_TAG)
                        parseTag(context, TagType.End, parent)
                        continue
                    } else {
                        emitError(context, ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME, 2)
                        node = parseBogusComment(context)
                    }
                } else if (/[a-z]/i.test(s[1])) { //这才是正文
                    node = parseElement(context, ancestors)

                    // 兼容 vue2.X
                    if (
                        __COMPAT__ &&
                        isCompatEnabled(
                            CompilerDeprecationTypes.COMPILER_NATIVE_TEMPLATE,
                            context
                        ) && node &&
                        node.tag === 'template' &&
                        !node.props.some(
                            p =>
                                p.type === NodeTypes.DIRECTIVE &&
                                isSpecialTemplateDirective(p.name)
                        )
                    ) {
                        __DEV__ &&
                            warnDeprecation(
                                CompilerDeprecationTypes.COMPILER_NATIVE_TEMPLATE,
                                context,
                                node.loc
                            )
                        node = node.children
                    }
                } else if (s[1] === '?') {

                    emitError(context, ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME, 1)
                    node = parseBogusComment(context)

                } else {
                    emitError(context, ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME, 1)
                }
            }
        }

        // 非节点类型，生成文本节点
        if (!node) {
            node = parseText(context, mode)
        }
        // 将子节点加入队列
        if (isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                pushNode(nodes, node[i])
            }
        } else {
            // 这里对文本节点做了优化，如果上一节点也为文本节点，NodeTypes.TEXT，将合并两个节点
            pushNode(nodes, node)
        }
    }

    let removedWhitespace = false
    if (mode !== TextModes.RAWTEXT && mode !== TextModes.RCDATA) {
        console.error(321321312323);

    }

    const result = removedWhitespace ? nodes.filter(Boolean) : nodes
    console.log(print(currentFilename, 'parseChildren()', '编译子标签,while循环字符串模版'), result)
    return result
}

function parseElement(
    context,
    ancestors
) {

    __TEST__ && assert(/^<[a-z]/i.test(context.source))

    // 标签开始部分
    // 例：<div class="hello" .stop.prevet="stop" v-bind:title.sync="doc.title" v-if="1" id="ddd" index-data="dd">hello world</div>
    // 只有 <div class="hello" .stop.prevet="stop" v-bind:title.sync="doc.title" v-if="1" id="ddd" index-data="dd"> 这部分
    const wasInpre = context.inPre
    const wasInPre = context.inVPre
    const parent = last(ancestors)
    // 从parseTag 
    const element = parseTag(context, TagType.Start, parent)
    const isPreBoundary = context.inPre && !wasInPre
    const isVPreBoundary = context.inVPre && !wasInPre //v-pre

    // isVoidTag 这个玩意不是始终返回false吗
    if (context.options.isVoidTag(element.tag)) {
        console.error('isVoidTag 返回 true 了');
    }

    // 如果是自闭合的标签 不需要提取标签内的文本内容，
    // 直接返回element
    if (element.isSelfClosing || context.options.isVoidTag(element.tag)) {
        // 自闭合的<pre>标签
        if (isPreBoundary) {
            context.inPre = false
        }
        // v-pre
        if (isVPreBoundary) {
            context.inPre = false
        }
        console.log(print(currentFilename, 'parseElement()', '单闭合标签直接返回'), element)
        return element
    }

    ancestors.push(element)
    // compiler-sfc parse getTextMode
    const mode = context.options.getTextMode(element, parent)
    const children = parseChildren(context, mode, ancestors)

    console.log(3242343, children)
    console.log(3242343, context)

    console.log(print(currentFilename, 'parseElement()', '非单闭合标签'), element)
    return element
}

function pushNode(nodes, node) {
    if (node.type === NodeTypes.TEXT) {
        const prev = last(nodes)
        // 如果此节点根上一个节点都是文本，并且是连续的，则进行合并
        if (
            prev &&
            prev.type === NodeTypes.TEXT &&
            prev.loc.end.offset === node.loc.start.offset
        ) {
            prev.content += node.content
            prev.loc.end = node.loc.end
            prev.loc.source += node.loc.source
            return
        }
    }
    nodes.push(node)
    console.log(print(currentFilename, 'pushNode()', '塞入数组nodes'), nodes)
}

function last(xs) {
    return xs[xs.length - 1]
}

function startsWith(source: string, searchString: string): boolean {
    return source.startsWith(searchString)
}

const enum TagType {
    Start,
    End
}

const isSpecialTemplateDirective = /*#__PURE__*/ makeMap(
    `if,else,else-if,for,slot`
)

// 生成标签节点。
function parseTag(
    context,
    type,
    parent
) {
    // __TEST__ && assert(/^<\/?[a-z]]/i.test(context.source))
    __TEST__ && assert(
        type === (startsWith(context.source, '</') ? TagType.End : TagType.Start)
    )

    const start = getCursor(context)
    // 拿到第一个标签 <style <script <template
    const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!
    const tag = match[1]
    // 始终是0？在上面枚举了
    const ns = context.options.getNamespace(tag, parent)

    advanceBy(context, match[0].length)
    advanceSpaces(context)

    // 保存当前状态，以防我们需要使用v-pre重新解析属性
    const cursor = getCursor(context)
    // 剩余需要解析的字符串
    const currentSource = context.source

    // check <pre> tag
    if (context.options.isPreTag(tag)) {
        context.inPre = true
    }

    // 拿出标签以后 剩余就是属性
    let props = parseAttributes(context, type)
    // console.log(9999,2,JSON.parse(JSON.stringify(props)))

    // 检查 v-pre
    if (
        type === TagType.Start &&
        !context.inVPre &&
        props.some(p => p.type === NodeTypes.DIRECTIVE && p.name === 'pre')
    ) {
        // 设置 inVPre 为 true
        context.inVPre = true
        // reset context 
        extend(context, cursor)
        // 回到刚去了标签的时候
        context.source = currentSource
        props = parseAttributes(context, type).filter(p => p.name !== 'pre')
        // console.log(9999,  props);
    }

    // 自闭合标签
    // <img src="23213" alt="2323" id="img" class="dd" />
    let isSelfClosing = false
    if (context.source.length === 0) {
        emitError(context, ErrorCodes.EOF_IN_TAG)
    } else {
        isSelfClosing = startsWith(context.source, '/>')

        if (type === TagType.End && isSelfClosing) {
            emitError(context, ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS)
        }

        // 妙呀
        // 如果是单闭合 '/>' 2, 如果是单闭合 '>' 就是1
        // 如果不是单闭合 现在应该是 <div xxx >刚结束的时候 也是1
        advanceBy(context, isSelfClosing ? 2 : 1)
    }

    // type是传过来的值 TagType.Start 怎么可能 根 TagType.End 相等呢？
    if (type === TagType.End) {
        return
    }

    // 兼容2.x
    if (
        __COMPAT__ &&
        __DEV__ &&
        isCompatEnabled(
            CompilerDeprecationTypes.COMPILER_V_IF_V_FOR_PRECEDENCE,
            context
        )
    ) {
        let hasIf = false
        let hasFor = false
        for (let i = 0; i < props.length; i++) {
            const p = props[i]
            if (p.type === NodeTypes.DIRECTIVE) {
                if (p.name === 'if') {
                    hasIf = true
                } else if (p.name === 'for') {
                    hasFor = true
                }
            }
            if (hasIf && hasFor) {
                warnDeprecation(
                    CompilerDeprecationTypes.COMPILER_V_IF_V_FOR_PRECEDENCE,
                    context,
                    getSelection(context, start)
                )
                break
            }
        }
    }


    let tagType = ElementTypes.ELEMENT
    // 当前element 不是pre
    // 重置下节点属性
    if (!context.inVPre) {
        if (tag === 'slot') {
            tagType = ElementTypes.SLOT
        } else if (tag === 'template') {  //除去开始的<template>
            if (
                props.some(
                    p =>
                        p.type === NodeTypes.DIRECTIVE && isSpecialTemplateDirective(p.name)
                )
            ) {
                tagType = ElementTypes.TEMPLATE
            }
        } else if (isComponent(tag, props, context)) {
            // TODO component 应该指的是 动态组件一类
            tagType = ElementTypes.COMPONENT
        }
    }

    const result = {
        type: NodeTypes.ELEMENT,
        ns,
        tag,
        tagType,
        props,
        isSelfClosing,
        children: [],
        loc: getSelection(context, start),
        codegenNode: undefined // to be created during transform phase
    }
    console.log(print(currentFilename, 'parseTag()'), result)
    return result
}

// 读头前进,
// 整个解析过程中经常调用的方法，负责对模版进行截取，不断改变当前解析模版的值，直到最后模版为空
function advanceBy(context, numberOfCharacters) {

    const { source } = context
    // 标签要比模版字符串要长
    __TEST__ && assert(numberOfCharacters <= source.length)
    // 变更坐标
    advancePositionWithMutation(context, source, numberOfCharacters)
    // 移除已知的部分 第一次移除 <template || <style || <script
    context.source = source.slice(numberOfCharacters)
    console.log(print(currentFilename, 'advanceBy()', '整个解析过程中经常调用的方法，负责对模版进行截取，不断改变当前解析模版的值，直到最后模版为空，while停止'), context.source)
}

// 对 \\t\\r\\n\\f 还有''删掉
function advanceSpaces(context) {
    const match = /^[\t\r\n\f ]+/.exec(context.source)
    if (match) {
        console.log(print(currentFilename, 'advanceSpaces()', '搞掉 \\t\\r\\n\\f 还有\' \'空格'), match)
        advanceBy(context, match[0].length)
    }
}

// 生成属性列表
function parseAttributes(
    context,
    type
) {
    // 存放属性节点
    const props = []
    const attributeNames = new Set()

    // 查找第一个闭合 ‘>’
    // 如果是<template>或者无属性的标签就直接return
    while (
        context.source.length > 0 &&
        !startsWith(context.source, '>') &&
        !startsWith(context.source, '/>')
    ) {

        // 如果<tempalte / /> 有错的时候
        if (startsWith(context.source, '/')) {
            emitError(context, ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG)
            // 移除 ‘’
            advanceBy(context, 1)
            advanceSpaces(context)
            continue
        }

        if (type === TagType.End) {
            emitError(context, ErrorCodes.END_TAG_WITH_ATTRIBUTES)
        }
        const attr = parseAttribute(context, attributeNames)

        // class
        if (
            attr.type === NodeTypes.ATTRIBUTE &&
            attr.value &&
            attr.name === 'class'
        ) {
            // class="hello  " => class="hello"
            attr.value.content = attr.value.content.replace(/\s+/g, ' ').trim()
        }


        if (type === TagType.Start) {
            props.push(attr)
        }

        if (/^[^\t\r\n\f />]/.test(context.source)) {
            emitError(context, ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES)
        }

        advanceSpaces(context)
    }
    console.log(print(currentFilename, 'parseAttributes()', '生成属性列表,如果是<template>,<div>无属性标签return []'), props)
    return props
}
function parseAttribute(
    context,
    nameSet
): any {
    __TEST__ && assert(/^[^\t\r\n\f />]/.test(context.source))

    // 拿到坐标
    const start = getCursor(context)
    // start 拿属性名
    // 哪一个先到 = 先到就是属性了 />就是结束了
    const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
    const name = match[0]
    // 属性是唯一的
    if (nameSet.has(name)) {
        // 两个 ID 报个错
        console.warn(`${name}重复了`);
        emitError(context, ErrorCodes.DUPLICATE_ATTRIBUTE)
    }
    nameSet.add(name)

    if (name[0] === '=') {
        emitError(context, ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME)
    }
    // 属性名不能包含' " <
    {
        const pattern = /["'<]/g
        let m: RegExpExecArray | null
        while ((m = pattern.exec(name))) {
            emitError(
                context,
                ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
                m.index
            )
        }

    }

    // 留下属性名称后面
    advanceBy(context, name.length)
    // end 

    // 拿value了
    let value = undefined
    // 拿到 ‘=’
    if (/^[\t\r\n\f ]*=/.test(context.source)) {
        // 去除 = 左边
        advanceSpaces(context)
        advanceBy(context, 1)
        // 去除 = 右边
        advanceSpaces(context)
        // 返回属性值
        value = parseAttributeValue(context)
        if (!value) {
            emitError(context, ErrorCodes.MISSING_ATTRIBUTE_VALUE)
        }
    }
    // <div id="xx" id="ddd" class="hello" index-data="dd">hello world</div>
    // source: "id=\"xx\""
    const loc = getSelection(context, start)

    // 是否有v-if/for/pre 等标签 以if为例子
    if (!context.inVPre && /^(v-[a-zA-Z0-9-]|:|\.|@|#)/.test(name)) {

        // 拿到v-xx 集合
        const match =
            /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
                name
            )!

        // .stop.prevet="stop" 这时候为true
        let isPropShorthand = startsWith(name, '.')

        let dirName = match[1] || (
            isPropShorthand || startsWith(name, ':')  // v-bind:title.sync
                ? 'bind'
                : startsWith(name, '@')
                    ? 'on'
                    : 'slot'
        )

        let arg
        // v-slot:header v-bind:title.sync="doc.title"
        // "header" "title"
        if (match[2]) {

            const isSlot = dirName === 'slot'
            // header 最后出现的位置 
            const startOffset = name.lastIndexOf(
                match[2], //header
                name.length - (match[3]?.length || 0) // (v-slot:header).length - ()
            )

            /**
             *  {
             *      end:{}
             *      start:{}
             *      source:"header"
             *  }
             */
            const loc = getSelection(
                context,
                getNewPosition(context, start, startOffset),
                getNewPosition(
                    context,
                    start,
                    startOffset + match[2].length + ((isSlot && match[3]) || '').length
                )
            )
            // header
            let content = match[2]
            let isStatic = true

            // v-slot:[header]
            if (content.startsWith('[')) {

                isStatic = false

                if (!content.endsWith(']')) {
                    emitError(
                        context,
                        ErrorCodes.X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END
                    )
                    content = content.slice(1)
                } else {
                    content = content.slice(1, content.length - 1)
                }
            } else if (isSlot) {
                // v-slot:header 
                //  ['v-slot:header', 'slot', 'header',]
                content += match[3] || ''
            }
            arg = {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content,
                isStatic,
                constType: isStatic
                    ? ConstantTypes.CAN_STRINGIFY
                    : ConstantTypes.NOT_CONSTANT,
                loc
            }

        }

        /**
         * v-bind:title.sync="doc.title"
         * {
         *   loc:{
         *       source: "\"doc.title\"" 处理以后 source: "doc.title"
         *    }
         * }
         */
        if (value && value.isQuoted) {
            const valueLoc = value.loc
            valueLoc.start.offset++
            valueLoc.start.column++
            valueLoc.end = advancePositionWithClone(valueLoc.start, value.content)
            valueLoc.source = valueLoc.source.slice(1, -1)
        }

        const modifiers = match[3] ? match[3].slice(1).split('.') : []
        if (isPropShorthand) modifiers.push('prop')

        //兼容2.x  v-bind:foo.sync -> v-model:foo
        // v-bind:title.sync="doc.title"
        if (__COMPAT__ && dirName === 'bind' && arg) {
            if (
                modifiers.includes('sync') &&
                checkCompatEnabled(
                    CompilerDeprecationTypes.COMPILER_V_BIND_SYNC,
                    context,
                    loc,
                    arg.loc.source
                )
            ) {
                dirName = 'model'
                modifiers.splice(modifiers.indexOf('sync'), 1)
            }

            if (__DEV__ && modifiers.includes('prop')) {
                checkCompatEnabled(
                    CompilerDeprecationTypes.COMPILER_V_BIND_PROP,
                    context,
                    loc
                )
            }
        }

        const result = {
            type: NodeTypes.DIRECTIVE,
            name: dirName,
            exp: value && {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: value.content,
                isStatic: false,
                constType: ConstantTypes.NOT_CONSTANT,
                loc: value.loc
            },
            arg,
            modifiers,
            loc
        }
        console.log(print(currentFilename, 'parseAttribute()', '生成有v-属性节点'), result)
        return result
    }

    // 缺少指令名 或者非法的指令名
    if (!context.inVPre && startsWith(name, 'v-')) {
        emitError(context, ErrorCodes.X_MISSING_DIRECTIVE_NAME)
    }

    const result = {
        type: NodeTypes.ATTRIBUTE,
        name,
        value: value && {
            type: NodeTypes.TEXT,
            content: value.content,
            loc: value.loc
        },
        loc
    }
    console.log(print(currentFilename, 'parseAttribute()', '生成不是"v-"属性节点'), result)

    return result
}
// 提取属性值
function parseAttributeValue(context) {


    const start = getCursor(context)
    let content: string

    // 属性 = 右边第一个字符
    const quote = context.source[0]
    const isQuoted = quote === `'` || quote === `"`
    if (isQuoted) {
        // 去除 ' /"
        advanceBy(context, 1)

        const endIndex = context.source.indexOf(quote)

        if (endIndex === -1) {
            /**
             * 单边单引号(')或者双引号("),一直到context内容结束都没有出现
             */
            // <div id  =  "xx >hello world</div> 
            content = parseTextData(
                context,
                context.source.length,
                TextModes.ATTRIBUTE_VALUE
            )
        } else {
            content = parseTextData(context, endIndex, TextModes.ATTRIBUTE_VALUE)
            advanceBy(context, 1)
        }
    } else {
        // id= xx
        // 空格的位置就是属性值结束的地方
        const match = /^[^\t\f\r\n >]+/.exec(context.source)
        if (!match) {
            return undefined
        }
        // value 不能包括 "'<=`
        const unexpectedChars = /["'<=`]/g
        let m: RegExpExecArray | null
        while ((m = unexpectedChars.exec(match[0]))) {
            emitError(
                context,
                ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
                m.index
            )
        }
        content = parseTextData(context, match[0].length, TextModes.ATTRIBUTE_VALUE)
    }

    const result = {
        content,
        isQuoted,
        loc: getSelection(context, start)
    }

    console.log(print(currentFilename, 'parseAttributeValue()', '提取属性值,有没有\'|\"都会返回'), result)

    return result
}

// 动态数据节点
function parseInterpolation(context, mode) {
    const [open, close] = context.options.delimiters
    __TEST__ && assert(startsWith(context.source, open))

    const closeIndex = context.source.indexOf(close, open.length)
    if (closeIndex === -1) {
        emitError(context, ErrorCodes.X_MISSING_INTERPOLATION_END)
        return undefined
    }

    // 例： {{ xx }}
    const start = getCursor(context)
    // 移动 {{ 的长度 就剩下  ' xx }}'
    advanceBy(context, open.length)
    // {{ }} 内 xx 的位置
    const innerStart = getCursor(context)
    const innerEnd = getCursor(context)
    // 总长度 closeIndex,减去 }} 的长度
    const rawContentLength = closeIndex - close.length
    // 剩下的就是内容
    const rawContent = context.source.slice(0, rawContentLength)
    // 到这为止 rawContent === preTrimContent
    const preTrimContent = parseTextData(context, rawContentLength, mode)

    // 有空格需要删除
    const content = preTrimContent.trim()
    const startOffset = preTrimContent.indexOf(content)
    // 当 {{ xx }} 存在空格，
    if (startOffset > 0) {
        advancePositionWithMutation(innerStart, rawContent, startOffset)
    }

    const endOffset = rawContentLength - (preTrimContent.length - content.length - startOffset)
    advancePositionWithMutation(innerEnd, rawContent, endOffset)
    // 移动 }} 的长度 
    advanceBy(context, close.length)

    const result = {
        type: NodeTypes.INTERPOLATION,
        content: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            isStatic: false,
            // 默认情况下，将“isConstant”设置为false，并将在transformExpression中决定
            constType: ConstantTypes.NOT_CONSTANT,
            content,
            loc: getSelection(context, innerStart, innerEnd)
        },
        loc: getSelection(context, start)
    }
    console.log(print(currentFilename, 'parseInterpolation()', '动态数据节点{{}}'), result)
    return result
}

// 生成文本节点
function parseText(
    context,
    mode
) {
    __TEST__ && assert(context.source.length > 0)

    const endTokens = mode === TextModes.CDATA ? [']]>'] : ['<', context.options.delimiters[0]]
    let endIndex = context.source.length
    /**
     * 1、<div>hello</div>
     * 检测 context.source 到 '<' 就是 文本字符串的长度
     * 2、<div>{{hello}}</div>
     * indexOf(endTokens[i],1),第二个参数1的原因 还是拿到 <
     */
    for (let i = 0; i < endTokens.length; i++) {
        const index = context.source.indexOf(endTokens[i], 1)
        if (index !== -1 && endIndex > index) {
            endIndex = index
        }
    }

    __TEST__ && assert(endIndex > 0)

    const start = getCursor(context)
    const content = parseTextData(context, endIndex, mode)

    const result = {
        type: NodeTypes.TEXT,
        content,
        loc: getSelection(context, start)
    }

    console.log(print(currentFilename, 'parseText()', '生成文本节点'), result)
    return result

}

// 提取文本数据
function parseTextData(
    context,
    length,
    mode
) {
    const rawText = context.source.slice(0, length)
    console.log(print(currentFilename, 'parseTextData()', `提取文本数据: ${rawText}`))
    advanceBy(context, length)

    if (
        mode === TextModes.RAWTEXT ||
        mode === TextModes.CDATA ||
        !rawText.includes('&')
    ) {
        return rawText
    } else {
        // 有& 需要实体解码
        return context.options.decodeEntities(
            rawText,
            mode === TextModes.ATTRIBUTE_VALUE
        )
    }
}

// 是否是组件
function isComponent(
    tag: string,
    props,
    context
) {
    console.log(print(currentFilename, 'isComponent()'))

    const options = context.options

    if (options.isCustomElement(tag)) {
        return false
    }

    if (
        tag === 'component' ||
        /^[A-Z]/.test(tag) ||
        isCoreComponent(tag) ||
        (options.isBuiltInComponent && options.isBuiltInComponent(tag)) ||
        (options.isNativeTag && !options.isNativeTag(tag))
    ) {
        return true
    }

    // TODO 少了一段
}

// 注释
function parseComment(context) {
    __TEST__ && assert(startsWith(context.source, '<!--'))

    //拿坐标
    const start = getCursor(context)
    let content: string

    const match = /--(\!)?>/.exec(context.source)
    // <!-- 这是注释 --
    if (!match) {
        content = context.source.slice(4)
        advanceBy(context, context.source.length)
        emitError(context, ErrorCodes.EOF_IN_COMMENT)
    } else {
        // match.index 到 --> 间隔字符的长度
        if (match.index <= 3) {
            emitError(context, ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT)
        }
        if (match[1]) {
            emitError(context, ErrorCodes.INCORRECTLY_CLOSED_COMMENT)
        }
        // <!-- 正好是 4
        content = context.source.slice(4, match.index)
        // 嵌套 <!-- <!-- 这是注释 --> -->
        const s = context.source.slice(0, match.index)
        let prevIndex = 1, nestedIndex = 0
        while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
            advanceBy(context, nestedIndex - prevIndex + 1)
            if (nestedIndex + 4 < s.length) {
                emitError(context, ErrorCodes.NESTED_COMMENT)
            }
            prevIndex = nestedIndex + 1
        }
        advanceBy(context, match.index + match[0].length - prevIndex + 1)
    }
    const result = {
        type: NodeTypes.COMMENT,
        content,
        loc: getSelection(context, start)
    }
    console.log(print(currentFilename, 'parseComment()'), result)
    return result
}

//<!DOCTYPE html>
function parseBogusComment(context) {
    __TEST__ && assert(/^<(?:[\!\?]|\/[^a-z>])/i.test(context.source))

    // 拿坐标
    const start = getCursor(context)
    const contentStart = context.source[1] === '?' ? 1 : 2
    let content: string

    const closeIndex = context.source.indexOf('>')
    if (closeIndex === -1) {
        content = context.source.slice(contentStart)
        advanceBy(context, context.source.length)
    } else {
        content = context.source.slice(contentStart, closeIndex)
        advanceBy(context, closeIndex + 1)
    }

    const result = {
        type: NodeTypes.COMMENT,
        content,
        loc: getSelection(context, start)
    }
    console.log(print(currentFilename, 'parseBogusComment()', '<!DOCTYPE html>'), result)
    return result
}

//生成CDATA节点
function parseCDATA(context, ancestors) {

    __TEST__ &&
        assert(last(ancestors) == null || last(ancestors)!.ns !== Namespaces.HTML)
    __TEST__ && assert(startsWith(context.source, '<![CDATA['))

    advanceBy(context, 9)
    const nodes = parseChildren(context, TextModes.CDATA, ancestors)
    if (context.source.length === 0) {
        emitError(context, ErrorCodes.EOF_IN_CDATA)
    } else {
        __TEST__ && assert(startsWith(context.source, ']]>'))
        advanceBy(context, 3)
    }

    console.log(print(currentFilename, 'parseCDATA()', '生成CDATA节点'), nodes, ancestors)
    return nodes
}

function emitError(
    context,
    code,
    offset?: number,
    loc = getCursor(context)
) {
    console.log(print(currentFilename, 'emitError()'), context, code, offset, loc)

    // <div id  =  xx"
    if (offset) {
        loc.offset += offset
        loc.column += offset
    }
    context.options.onError(
        createCompilerError(code, {
            start: loc,
            end: loc,
            source: ''
        })
    )
}

// 生成选取对象
function getSelection(
    context,
    start,
    end?: {
        offset: number
        line: number
        column: number
    }
) {
    end = end || getCursor(context)

    const result = {
        start,
        end,
        source: context.originalSource.slice(start.offset, end.offset)
    }

    console.log(print(currentFilename, 'getSelection()', '生成选取对象'), result)

    return result
}

// 生成新位置信息对象
function getNewPosition(
    context,
    start,
    numberOfCharacters: number
) {
    const result = advancePositionWithClone(
        start,
        context.originalSource.slice(start.offset, numberOfCharacters),
        numberOfCharacters
    )
    console.log(print(currentFilename, 'getNewPosition()', '生成新位置信息对象'), result)
    return result
}

// 是否读取结束
function isEnd(
    context,
    mode,
    ancestors
): boolean {
    console.log(print(currentFilename, 'isEnd()'), context, mode, ancestors)

    // 拿到vue内容
    const s = context.source
    switch (mode) {
        case TextModes.DATA: // 0 
            // 可能性能不佳 结束标签
            if (startsWith(s, '</')) {
                for (let i = ancestors.length - 1; i >= 0; --i) {
                    if (startsWithEndTagOpen(s, ancestors[i].tag)) {
                        return true
                    }
                }
            }
            break;

        // 标签内的text <div>xxx</div>
        case TextModes.RCDATA:
        case TextModes.RAWTEXT: {
            // 父级就是对应 ancestors 最后一个 元素
            const parent = last(ancestors)
            // 是否有父级 是否以结束标签开始
            if (parent && startsWithEndTagOpen(s, parent.tag)) {
                return true
            }
            break
        }

        case TextModes.CDATA:
            if (startsWith(s, ']]>')) {
                console.error('TextModes.CDATA');
                // console.log(print(currentFilename, 'isEnd()->TextModes.CDATA'), startsWith(s, ']]>'))
                return true
            }
            break
    }

    return !s
}

// 是否以结束标签开头
function startsWithEndTagOpen(
    source,
    tag
) {
    const result = (
        startsWith(source, '</') &&
        source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
        /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
    )
    console.log(print(currentFilename, 'startsWithEndTagOpen()', '是否以结束标签开头'), result)
    return result
}