import { NO, extend, print } from "@vue/shared"
import { Namespaces, createRoot } from "./ast"
import { defaultOnError, defaultOnWarn } from "./errors"
import { assert } from "./utils"

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
        line: 1,
        offset: 0,
        originalSource: content,
        source: content,
        inPre: false,
        inVPre: false,
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

export const defaultParserOptions = {
    delimiters: [`{{`, `}}`],
    getNamespace: () => Namespaces.HTML,
    getTextMode: () => TextModes.DATA,
    isVoidTag: NO,
    isPreTag: NO,
    isCustomElement: NO,
    decodeEntities: (rawText: string): string => rawText.replace(
        decodeRE, (_, p1) => decodeMap[p1]
    ),
    onError: defaultOnError,
    onWarn: defaultOnWarn,
    commits: __DEV__
}

export const enum TextModes {
    //          | Elements | Entities | End sign              | Inside of
    DATA, //    | ✔        | ✔        | End tags of ancestors |
    RCDATA, //  | ✘        | ✔        | End tag of the parent | <textarea>
    RAWTEXT, // | ✘        | ✘        | End tag of the parent | <style>,<script>
    CDATA,
    ATTRIBUTE_VALUE
}

function getCursor(context) {
    console.log(print(currentFilename, 'getCursor()'), context)

    const { column, line, offset } = context
    return { column, line, offset }
}

function parseChildren(
    context,
    mode,
    ancestors
) {
    console.log(print(currentFilename, 'parseChildren()'), context, mode, ancestors)

    const parent = last(ancestors)
    if (parent) {
        console.log(print('有了父级', 'parseChildren()'), parent)
    }
    // 0
    const ns = parent ? parent.ns : Namespaces.HTML
    const nodes = []
    
    while (!isEnd(context, mode, ancestors)) {

        __TEST__ && assert(context.source.length > 0)
        const s = context.source
        let node = undefined

        console.log(
            'mode-->', mode,'\n',
            'TextModes.DATA-->', TextModes.DATA,'\n',
            'TextModes.RCDATA-->', TextModes.RCDATA,'\n',
            'TextModes.RAWTEXT-->', TextModes.RAWTEXT,'\n',
            'TextModes.CDATA-->', TextModes.CDATA,'\n',
            'TextModes.ATTRIBUTE_VALUE-->', TextModes.ATTRIBUTE_VALUE
        )

        if ( mode === TextModes.DATA || mode === TextModes.RCDATA ) { 
            if (!context.inVPre && startsWith(s, context.options.decodeEntities[0])) {
                
                console.log(print(currentFilename, 'while'), context.inVPre )
                
            } else if(mode === TextModes.DATA && s[0] === '<'){ 
                console.log(333);
                
            }
        }

        break
    }



}

function last(xs) {
    return xs[xs.length - 1]
}

function startsWith(source: string, searchString: string): boolean {
    return source.startsWith(searchString)
}

function isEnd(
    context,
    mode,
    ancestors
): boolean {
    console.log(print(currentFilename, 'isEnd()'), context, mode, ancestors)

    // 拿到vue内容
    const s = context.source
    switch (mode) {
        case TextModes.DATA: // 0 ?
            // 可能性能不佳
            if (startsWith(s, '</')) {
                console.log(print(currentFilename, 'isEnd()->TextModes.DATA'), startsWith(s, '</'))

            }
            break;

        case TextModes.RCDATA:
        case TextModes.RAWTEXT: {

            const parent = last(ancestors)
            console.log(print(currentFilename, 'isEnd()->TextModes.RCDATA,RAWTEXT'), parent)
            break
        }

        case TextModes.CDATA:
            if (startsWith(s, ']]>')) {
                console.log(print(currentFilename, 'isEnd()->TextModes.CDATA'), startsWith(s, ']]>'))
                return true
            }
            break
    }

    return !s
}

function getSelection(
    context,
    start,
    end?: {
        offset: number
        line: number
        column: number
    }
) {
    console.log(print(currentFilename, 'getSelection()'), context, start, end)

    end = end || getCursor(context)
    return {
        start,
        end,
        soure: context.originalSource.slice(start.offset, end.offset)
    }
}