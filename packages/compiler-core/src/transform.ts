import { EMPTY_OBJ, NOOP, PatchFlagNames, PatchFlags, camelize, capitalize, isArray, isObject, isString, print } from "@vue/shared";
import { ConstantTypes, ElementTypes, NodeTypes, convertToBlock, createCacheExpression, createSimpleExpression, createVNodeCall } from "./ast";
import { isVSlot } from "./utils";
import { defaultOnError, defaultOnWarn } from "./errors";
import { CREATE_COMMENT, FRAGMENT, TO_DISPLAY_STRING, helperNameMap } from "./runtimeHelpers";
import { hoistStatic, isSingleElementRoot } from "./transforms/hoistStatic";


const currentFilename = 'compiler-core/compile.ts'


// 将ast转换成JavaScript AST
export function transform(root, options) {
    // 创建转换上下文
    const context = createTransformContext(root, options)

    // 整个AST转化环节最核心的方法
    //  遍历所有节点，执行转换
    traverseNode(root, context)
    
    // 如果编译选项中打开了 hoistStatic 开关，则进行静态提升
    // 默认开启
    if (options.hoistStatic) {
        /**
         * 通过 walk 递归循环 ast 节点
         * 在 codegenNode 
         * 存在纯静态标签 添加 hoisted 对象，并将静态 patchFlag 标记为 -1
         * 存在指令 设置 dynamicProps 对象，如：@click="click" 转为 onclick
         * 存在属性静态 在 props内添加 hoisted 对象
         */
        hoistStatic(root, context)
    }
    
    // 不能是 ssr
    if (!options.ssr) {
        // 这时候在 root 下 codegenNode 还是 undefined,
        // 但是 children 下的 codegenNode 是存在的
        createRootCodegen(root, context)
    }

    // 确定元信息
    root.helpers = new Set([...context.helpers.keys()])
    root.components = [...context.components]
    root.directives = [...context.directives]
    root.imports = context.imports
    root.hoists = context.hoists
    root.temps = context.temps
    root.cached = context.cached

    if (__COMPAT__) {
        root.filters = [...context.filters!]
    }
    console.log(print(currentFilename, 'transform', `将ast转换成JavaScript AST`), root)
}

// 创建转换所需的上下文对象，里面包括helpers等属性和各类帮助函数，记录转换过程中的信息和转换中所需的各种辅助函数
export function createTransformContext(
    root,
    {
        filename = '',
        prefixIdentifiers = false,
        hoistStatic = false,
        cacheHandlers = false,
        nodeTransforms = [],
        directiveTransforms = {},
        transformHoist = null,
        isBuiltInComponent = NOOP,
        isCustomElement = NOOP,
        expressionPlugins = [],
        scopeId = null,
        slotted = true,
        ssr = false,
        inSSR = false,
        ssrCssVars = ``,
        bindingMetadata = EMPTY_OBJ,
        inline = false,
        isTS = false,
        onError = defaultOnError,
        onWarn = defaultOnWarn,
        compatConfig
    }
) {
    const nameMatch = filename.replace(/\?.*$/, '').match(/([^/\\]+)\.\w+$/)

    const context: any = {
        // options
        selfName: nameMatch && capitalize(camelize(nameMatch[1])),
        prefixIdentifiers,
        hoistStatic,
        cacheHandlers,
        nodeTransforms,
        directiveTransforms,
        transformHoist,
        isBuiltInComponent,
        isCustomElement,
        expressionPlugins,
        scopeId,
        slotted,
        ssr,
        inSSR,
        ssrCssVars,
        bindingMetadata,
        inline,
        isTS,
        onError,
        onWarn,
        compatConfig,

        // state
        root,
        helpers: new Map(),
        components: new Set(),
        directives: new Set(),
        hoists: [],
        imports: [],
        constantCache: new Map(),
        temps: 0,
        cached: 0,
        identifiers: Object.create(null),
        scopes: {
            vFor: 0,
            vSlot: 0,
            vPre: 0,
            vOnce: 0
        },
        parent: null,
        currentNode: root,
        childIndex: 0,
        inVOnce: false,

        // methods
        helper(name) {
            const count = context.helpers.get(name) || 0
            context.helpers.set(name, count + 1)
            return name
        },
        removeHelper(name) {
            const count = context.helpers.get(name)
            if (count) {
                const currentCount = count - 1
                if (!currentCount) {
                    context.helpers.delete(name)
                } else {
                    context.helpers.set(name, currentCount)
                }
            }
        },
        helperString(name) {
            return `_${helperNameMap[context.helper(name)]}`
        },
        replaceNode(node) {
            /* istanbul ignore if */
            if (__DEV__) {
                if (!context.currentNode) {
                    throw new Error(`Node being replaced is already removed.`)
                }
                if (!context.parent) {
                    throw new Error(`Cannot replace root node.`)
                }
            }
            context.parent!.children[context.childIndex] = context.currentNode = node
        },
        removeNode(node) { //移除 script style
            // 根节点 如果是 sfc 会有 template script style
            const list = context.parent!.children
            const removalIndex = node
                ? list.indexOf(node)
                : context.currentNode
                    ? context.childIndex
                    : -1

            if (!node || node === context.currentNode) {
                // 当前节点为空
                context.currentNode = null
                context.onNodeRemoved()
            } else {
                if (context.childIndex > removalIndex) {
                    context.childIndex--
                    context.onNodeRemoved()
                }
            }
            context.parent!.children.splice(removalIndex, 1)
        },
        onNodeRemoved: () => { },
        addIdentifiers(exp) {
            if (isString(exp)) {
                addId(exp)
            } else if (exp.identifiers) {
                exp.identifiers.forEach(addId)
            } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
                addId(exp.content)
            }
        },
        removeIdentifiers(exp) {
            if (isString(exp)) {
                removeId(exp)
            } else if (exp.identifiers) {
                exp.identifiers.forEach(removeId)
            } else if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
                removeId(exp.content)
            }
        },
        // const _hoisted_5 = { style: {"color":"red"} }
        hoist(exp) {
            if (isString(exp)) exp = createSimpleExpression(exp)
            context.hoists.push(exp)
            // 设置 静态标记 _hoisted_
            const identifier = createSimpleExpression(
                `_hoisted_${context.hoists.length}`,
                false,
                exp.loc,
                ConstantTypes.CAN_HOIST
            )
            // 静态对象 存放到 hoisted
            identifier.hoisted = exp
            return identifier
        },
        cache(exp, isVNode = false) {
            return createCacheExpression(context.cached++, exp, isVNode)
        }
    }

    if (__COMPAT__) {
        context.filters = new Set()
    }


    function addId(id: string) {
        const { identifiers } = context
        if (identifiers[id] === undefined) {
            identifiers[id] = 0
        }
        identifiers[id]!++
    }

    function removeId(id: string) {
        context.identifiers[id]!--
    }

    console.log(print(currentFilename, 'createTransformContext', `创建一个上下文对象`), context)
    return context
}

//  对整个节点从根节点开始进行递归，对每一个节点进行转换
export function traverseNode(
    node: any,
    context: any
) {
    // 获取当前节点
    context.currentNode = node;
    // 获取节点转换的函数
    const { nodeTransforms } = context;
    // 退出函数，存放转换的回调函数，只有父节点下的子节点都执行完了，父节点才开始转换
    const exitFns = [];
    // 遍历所有的节点转换函数
    // 1.ignoreSideEffectTags
    // 2.transformStyle
    // 3.warnTransitionChildren
    // 4.transformOnce
    // 5.transformIf
    // 6.transformFor
    // 7.transformExpression
    // 8.transformSlotOutlet
    // 9.transformElement
    // 10.trackSlotScopes
    // 11.transformText
    // 这些转换函数并非直接执行转换，还是对节点进行判断，如果符合转换的要求就返回一个退出函数
    // 等待之后执行转换，if和for的转换还会对节点进行加工等操作
    for (let i = 0; i < nodeTransforms.length; i++) {
        // 对当前节点调用每一个转换函数，如果符合转换类型就会返回对应转换的转换函数（退出函数）
        // 这里并非执行转换的地方，只是将转换函数（退出函数）返回回来，在最后执行，这样保证了执行顺序是先子节点后本节点
        const onExit = nodeTransforms[i](node, context)
        //  如果存在匹配的转换函数就存放起来，等待后续子节点遍历结束后调用
        if (onExit) {
            if (isArray(onExit)) {
                exitFns.push(...onExit)
            } else {
                exitFns.push(onExit)
            }
        }
        // 在转换过程中会存在节点改变的情况，比如for/if会替换当前节点
        if (!context.currentNode) {
            // node was removed
            return
        } else {
            // node may have been replaced
            node = context.currentNode
        }
    }

    // 当前节点遍历完转换函数后，根据当前节点的类型，执行不同的分支
    switch (node.type) {
        case NodeTypes.COMMENT: //注释
            if (!context.ssr) {
                // inject import for the Comment symbol, which is needed for creating
                // comment nodes with `createVNode`
                context.helper(CREATE_COMMENT)
            }
            break
        case NodeTypes.INTERPOLATION:   // {{ xx }}
            // no need to traverse, but we need to inject toString helper
            if (!context.ssr) {
                context.helper(TO_DISPLAY_STRING)
            }
            break

        // if语句，父执行上边的转换后节点会有改变，这里会对分支节点进行进一步处理
        case NodeTypes.IF:
            // 对v-if生成的节点束进行遍历
            // console.error(`NodeTypes.IF`,);
            for (let i = 0; i < node.branches.length; i++) {
                traverseNode(node.branches[i], context)
            }
            break
        // if的分支节点，for循环节点，元素节点，根节点都会遍历其子节点，对其子节点进一步转换
        case NodeTypes.IF_BRANCH:
        case NodeTypes.FOR:
        case NodeTypes.ELEMENT:
        case NodeTypes.ROOT:
            // 遍历子节点
            traverseChildren(node, context)
            break
    }
    // 这里才开始执行真正的转换函数
    // 当前节点无需再遍历子节点时执行本节点前面放入的退出函数
    // 放在最后执行转换函数保证了子节点都转换完毕了再执行父节点的转换

    // 洋葱模型
    // 遍历nodeTransforms上的函数并依次执行，每个函数执行的返回结果都是一个函数，将这些返回的函数存放在一个数组中；
    // 对子节点进行转化操作；
    // 遍历第一步中数组中保存的函数并执行
    context.currentNode = node
    let i = exitFns.length
    while (i--) {
        exitFns[i]()
    }

    console.log(print(currentFilename, 'traverseNode', `当前node:${node.tag ? 'tag:' + node.tag : isObject(node.content) ? 'content:' + node.content?.content : 'content:' + node.content}`), node)
}

// 对每一个子节点进行traverseNode调用
export function traverseChildren(
    parent: ParentNode,
    context: any
) {
    let i = 0
    const nodeRemoved = () => {
        i--
    }
    // parent 可能包含<template><script><style>
    // 直接运行时 顶级标签不包括<template><script><style>，直接从<div>、<p>。。。
    for (; i < parent.children.length; i++) {
        const child = parent.children[i]

        if (isString(child)) continue

        context.parent = parent
        // 记录索引部分处理中对节点进行删除等操作时使用到
        context.childIndex = i
        // 在处理中例如if分支处理时会使用该函数移除节点
        context.onNodeRemoved = nodeRemoved
        // 调用遍历节点
        traverseNode(child, context)
    }
}

/**
 * 处理运行时指令，在编译过程中处理特定的结构性指令（例如 v-for, v-if, v-else-if, v-else 等）。
 * 在编译过程中，当遇到符合 nameMatcher 的结构性指令时，就会调用返回的处理函数进行处理
 * 
 * @param name 正则表达式或字符串，用于匹配需要被处理的指令名称
 * @param fn 一个函数，用于处理结构性指令。该函数有三个参数：
*      @param node：当前节点对象。
*      @param dir：当前节点上的指令对象。
*      @param context：编译上下文对象，包含编译期间的各种配置和数据。
 * @returns  函数会返回一个函数，该函数接收一个节点对象和编译上下文对象，用于根据指定的 nameMatcher 匹配到对应的指令后，调用用户自定义的 fn 函数进行处理
 */
export function createStructuralDirectiveTransform(
    name: string | RegExp,
    fn: any = (
        node: any, dir: any, context: any
    ) => { }
) {
    const matches = isString(name)
        ? (n: string) => n === name
        : (n: string) => name.test(n)

    return (node, context) => {
        if (node.type === NodeTypes.ELEMENT) { //node.type === 1
            const { props } = node
            // structural directive transforms are not concerned with slots
            // as they are handled separately in vSlot.ts
            if (node.tagType === ElementTypes.TEMPLATE && props.some(isVSlot)) {
                return
            }
            const exitFns = []
            for (let i = 0; i < props.length; i++) {
                /**
                 * 例：<div id="div" class="div" data-id="ddd" >
                 * {type: 6, name: 'id', value: {…}, loc: {…}}
                 * {type: 6, name: 'class', value: {…}, loc: {…}}
                 * {type: 6, name: 'data-id', value: {…}, loc: {…}}
                 */
                const prop = props[i]

                //v-  if elseif else for
                if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
                    // structural directives are removed to avoid infinite recursion
                    // also we remove them *before* applying so that it can further
                    // traverse itself in case it moves the node around
                    props.splice(i, 1)
                    i--
                    const onExit = fn(node, prop, context)
                    if (onExit) exitFns.push(onExit)
                }
            }

            if (exitFns.length) {
                console.log(print(currentFilename, 'createStructuralDirectiveTransform', `${name},处理特定的结构性指令:v-for, v-if, v-else-if, v-else`), exitFns)
            }
            return exitFns
        }
    }

}

// root 下 设置 codegenNode
function createRootCodegen(root: any, context: any) {

    const { helper } = context
    const { children } = root


    // 只存在一个一级节点
    if (children.length === 1) {
        const child = children[0]
        // 如果是是单元素根 并且存在 codegenNode
        // 那么 root 的 codegenNode 就是 child.codegenNode
        if (isSingleElementRoot(root, child) && child.codegenNode) {
            // 单元素根永远不会被提升，因此 codegenNode 永远不会被提升
            // 简单表达式节点
            const codegenNode = child.codegenNode
            if (codegenNode.type === NodeTypes.VNODE_CALL) {
                convertToBlock(codegenNode, context)
            }
            root.codegenNode = codegenNode
        } else {
            // - single <slot/>, IfNode, ForNode: already blocks.
            // - single text node: always patched.
            // root codegen falls through via genNode()
            root.codegenNode = child
        }
    }
    // v3 可以有多个一级节点
    else if (children.length > 1) {
        // return a fragment block
        let patchFlag = PatchFlags.STABLE_FRAGMENT
        let patchFlagText = PatchFlagNames[PatchFlags.STABLE_FRAGMENT]

        // 是否真的只有一个 不能有 注释
        if (
            __DEV__ &&
            children.filter(c => c.type !== NodeTypes.COMMENT).length === 1
        ) {
            patchFlag |= PatchFlags.DEV_ROOT_FRAGMENT
            patchFlagText += `, ${PatchFlagNames[PatchFlags.DEV_ROOT_FRAGMENT]}`
        }

        root.codegenNode = createVNodeCall(
            context,
            helper(FRAGMENT),
            undefined,
            root.children,
            patchFlag + (__DEV__ ? ` /* ${patchFlagText} */` : ``),
            undefined,
            undefined,
            true,
            undefined,
            false /* isComponent */
        )
    } else {
        // 不能存在
    }
    console.log(print(currentFilename, 'createRootCodegen', `设置 codegenNode`), root.codegenNode)
}