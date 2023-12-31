import { CREATE_STATIC, ConstantTypes, ElementTypes, NodeTypes, createCallExpression } from "@vue/compiler-core"
import { escapeHtml, isBooleanAttr, isKnownHtmlAttr, isKnownSvgAttr, isString, isSymbol, isVoidTag, makeMap, normalizeClass, normalizeStyle, stringifyStyle, toDisplayString } from "@vue/shared"
import { DOMNamespaces } from "../parserOptions"


export const enum StringifyThresholds {
    ELEMENT_WITH_BINDING_COUNT = 5,
    NODE_COUNT = 20
}

const replaceHoist = (
    node: any,
    replacement: any | null,
    context: any
) => {
    const hoistToReplace = (node.codegenNode as any).hoisted!
    context.hoists[context.hoists.indexOf(hoistToReplace)] = replacement
}

/**
 * Regex for replacing placeholders for embedded constant variables
 * (e.g. import URL string constants generated by compiler-sfc)
 */
const expReplaceRE = /__VUE_EXP_START__(.*?)__VUE_EXP_END__/g

/**
 * 
    什么是静态提升(static hoisting)

    <div>
        <div>foo</div> <!-- hoisted -->
        <div>bar</div> <!-- hoisted -->
        <div>{{ dynamic }}</div>
    </div>

    在patch的时候diff操作遇到他们实际上是可以直接跳过的，因为他们都不会变，节点比较过程中它们完全没必要比对
 */

export const stringifyStatic = (children, context, parent) => {
    // bail stringification for slot content
    if (context.scopes.vSlot > 0) {
        return
    }

    let nc = 0 // current node count
    let ec = 0 // current element with binding count
    const currentChunk: any[] = []

    const stringifyCurrentChunk = (currentIndex: number): number => {
        if (
            nc >= StringifyThresholds.NODE_COUNT ||
            ec >= StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
        ) {
            // combine all currently eligible nodes into a single static vnode call
            const staticCall = createCallExpression(context.helper(CREATE_STATIC), [
                JSON.stringify(
                    currentChunk.map(node => stringifyNode(node, context)).join('')
                ).replace(expReplaceRE, `" + $1 + "`),
                // the 2nd argument indicates the number of DOM nodes this static vnode
                // will insert / hydrate
                String(currentChunk.length)
            ])
            // replace the first node's hoisted expression with the static vnode call
            replaceHoist(currentChunk[0], staticCall, context)

            if (currentChunk.length > 1) {
                for (let i = 1; i < currentChunk.length; i++) {
                    // for the merged nodes, set their hoisted expression to null
                    replaceHoist(currentChunk[i], null, context)
                }

                // also remove merged nodes from children
                const deleteCount = currentChunk.length - 1
                children.splice(currentIndex - currentChunk.length + 1, deleteCount)
                return deleteCount
            }
        }
        return 0
    }

    let i = 0
    for (; i < children.length; i++) {
        const child = children[i]
        const hoisted = getHoistedNode(child)
        if (hoisted) {
            // presence of hoisted means child must be a stringifiable node
            const node = child as any
            const result = analyzeNode(node)
            if (result) {
                // node is stringifiable, record state
                nc += result[0]
                ec += result[1]
                currentChunk.push(node)
                continue
            }
        }
        // we only reach here if we ran into a node that is not stringifiable
        // check if currently analyzed nodes meet criteria for stringification.
        // adjust iteration index
        i -= stringifyCurrentChunk(i)
        // reset state
        nc = 0
        ec = 0
        currentChunk.length = 0
    }
    // in case the last node was also stringifiable
    stringifyCurrentChunk(i)
}

const getHoistedNode = (node: any) =>
    ((node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.ELEMENT) ||
        node.type == NodeTypes.TEXT_CALL) &&
    node.codegenNode &&
    node.codegenNode.type === NodeTypes.SIMPLE_EXPRESSION &&
    node.codegenNode.hoisted


const isNonStringifiable = /*#__PURE__*/ makeMap(
    `caption,thead,tr,th,tbody,td,tfoot,colgroup,col`
)

const dataAriaRE = /^(data|aria)-/
const isStringifiableAttr = (name: string, ns: any) => {
    return (
        (ns === DOMNamespaces.HTML
            ? isKnownHtmlAttr(name)
            : ns === DOMNamespaces.SVG
                ? isKnownSvgAttr(name)
                : false) || dataAriaRE.test(name)
    )
}

/**
 * for a hoisted node, analyze it and return:
 * - false: bailed (contains non-stringifiable props or runtime constant)
 * - [nc, ec] where
 *   - nc is the number of nodes inside
 *   - ec is the number of element with bindings inside
 */
function analyzeNode(node: any): [number, number] | false {
    if (node.type === NodeTypes.ELEMENT && isNonStringifiable(node.tag)) {
        return false
    }

    if (node.type === NodeTypes.TEXT_CALL) {
        return [1, 0]
    }

    let nc = 1 // node count
    let ec = node.props.length > 0 ? 1 : 0 // element w/ binding count
    let bailed = false
    const bail = (): false => {
        bailed = true
        return false
    }

    // TODO: check for cases where using innerHTML will result in different
    // output compared to imperative node insertions.
    // probably only need to check for most common case
    // i.e. non-phrasing-content tags inside `<p>`
    function walk(node: any): boolean {
        for (let i = 0; i < node.props.length; i++) {
            const p = node.props[i]
            // bail on non-attr bindings
            if (
                p.type === NodeTypes.ATTRIBUTE &&
                !isStringifiableAttr(p.name, node.ns)
            ) {
                return bail()
            }
            if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind') {
                // bail on non-attr bindings
                if (
                    p.arg &&
                    (p.arg.type === NodeTypes.COMPOUND_EXPRESSION ||
                        (p.arg.isStatic && !isStringifiableAttr(p.arg.content, node.ns)))
                ) {
                    return bail()
                }
                if (
                    p.exp &&
                    (p.exp.type === NodeTypes.COMPOUND_EXPRESSION ||
                        p.exp.constType < ConstantTypes.CAN_STRINGIFY)
                ) {
                    return bail()
                }
            }
        }
        for (let i = 0; i < node.children.length; i++) {
            nc++
            const child = node.children[i]
            if (child.type === NodeTypes.ELEMENT) {
                if (child.props.length > 0) {
                    ec++
                }
                walk(child)
                if (bailed) {
                    return false
                }
            }
        }
        return true
    }

    return walk(node) ? [nc, ec] : false
}

function stringifyNode(
    node: string | any,
    context: any
): string {
    if (isString(node)) {
        return node
    }
    if (isSymbol(node)) {
        return ``
    }
    switch (node.type) {
        case NodeTypes.ELEMENT:
            return stringifyElement(node, context)
        case NodeTypes.TEXT:
            return escapeHtml(node.content)
        case NodeTypes.COMMENT:
            return `<!--${escapeHtml(node.content)}-->`
        case NodeTypes.INTERPOLATION:
            return escapeHtml(toDisplayString(evaluateConstant(node.content)))
        case NodeTypes.COMPOUND_EXPRESSION:
            return escapeHtml(evaluateConstant(node))
        case NodeTypes.TEXT_CALL:
            return stringifyNode(node.content, context)
        default:
            // static trees will not contain if/for nodes
            return ''
    }
}

function stringifyElement(
    node: any,
    context: any
): string {
    let res = `<${node.tag}`
    let innerHTML = ''
    for (let i = 0; i < node.props.length; i++) {
        const p = node.props[i]
        if (p.type === NodeTypes.ATTRIBUTE) {
            res += ` ${p.name}`
            if (p.value) {
                res += `="${escapeHtml(p.value.content)}"`
            }
        } else if (p.type === NodeTypes.DIRECTIVE) {
            if (p.name === 'bind') {
                const exp = p.exp as any
                if (exp.content[0] === '_') {
                    // internally generated string constant references
                    // e.g. imported URL strings via compiler-sfc transformAssetUrl plugin
                    res += ` ${(p.arg as any).content
                        }="__VUE_EXP_START__${exp.content}__VUE_EXP_END__"`
                    continue
                }
                // #6568
                if (
                    isBooleanAttr((p.arg as any).content) &&
                    exp.content === 'false'
                ) {
                    continue
                }
                // constant v-bind, e.g. :foo="1"
                let evaluated = evaluateConstant(exp)
                if (evaluated != null) {
                    const arg = p.arg && (p.arg as any).content
                    if (arg === 'class') {
                        evaluated = normalizeClass(evaluated)
                    } else if (arg === 'style') {
                        evaluated = stringifyStyle(normalizeStyle(evaluated))
                    }
                    res += ` ${(p.arg as any).content}="${escapeHtml(
                        evaluated
                    )}"`
                }
            } else if (p.name === 'html') {
                // #5439 v-html with constant value
                // not sure why would anyone do this but it can happen
                innerHTML = evaluateConstant(p.exp as any)
            } else if (p.name === 'text') {
                innerHTML = escapeHtml(
                    toDisplayString(evaluateConstant(p.exp as any))
                )
            }
        }
    }
    if (context.scopeId) {
        res += ` ${context.scopeId}`
    }
    res += `>`
    if (innerHTML) {
        res += innerHTML
    } else {
        for (let i = 0; i < node.children.length; i++) {
            res += stringifyNode(node.children[i], context)
        }
    }
    if (!isVoidTag(node.tag)) {
        res += `</${node.tag}>`
    }
    return res
}

// __UNSAFE__
// Reason: eval.
// It's technically safe to eval because only constant expressions are possible
// here, e.g. `{{ 1 }}` or `{{ 'foo' }}`
// in addition, constant exps bail on presence of parens so you can't even
// run JSFuck in here. But we mark it unsafe for security review purposes.
// (see compiler-core/src/transforms/transformExpression)
function evaluateConstant(exp: any): string {
    if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
        return new Function(`return (${exp.content})`)()
    } else {
        // compound
        let res = ``
        exp.children.forEach(c => {
            if (isString(c) || isSymbol(c)) {
                return
            }
            if (c.type === NodeTypes.TEXT) {
                res += c.content
            } else if (c.type === NodeTypes.INTERPOLATION) {
                res += toDisplayString(evaluateConstant(c.content))
            } else {
                res += evaluateConstant(c)
            }
        })
        return res
    }
}
