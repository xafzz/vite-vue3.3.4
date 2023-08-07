import { isArray, isString, isSymbol, print } from "@vue/shared"
import { CREATE_COMMENT, CREATE_ELEMENT_VNODE, CREATE_STATIC, CREATE_TEXT, CREATE_VNODE, OPEN_BLOCK, POP_SCOPE_ID, PUSH_SCOPE_ID, RESOLVE_COMPONENT, RESOLVE_DIRECTIVE, RESOLVE_FILTER, SET_BLOCK_TRACKING, TO_DISPLAY_STRING, WITH_CTX, WITH_DIRECTIVES, helperNameMap } from "./runtimeHelpers"
import { NodeTypes, Position, getVNodeBlockHelper, getVNodeHelper, locStub } from "./ast"
import { advancePositionWithMutation, assert, isSimpleIdentifier, toValidAssetId } from "./utils"
import { SourceMapGenerator } from 'source-map-js'


const currentFilename = 'compiler-core/compile.ts'

// 在某些节点类型生成字符串前，添加 /*#__PURE__*/ 注释前缀，表明该节点是静态节点
const PURE_ANNOTATION = `/*#__PURE__*/`

const aliasHelper = (s: symbol) => `${helperNameMap[s]}: _${helperNameMap[s]}`

/**
 * 在生成一个VUE对象的编译过程执行结束时
 * 会从编译的结果中拿到一个 code 的 string 类型变量
 * 用这个生成的代码字符串 配合 Function 类的构造函数生成 render 渲染函数
 * 最终用生成的渲染函数完成对应组件的渲染
 */
export function generate(
    ast,
    options: any & {
        onContextCreated?: (context: any) => void
    } = {}
): any {
    // 1、生成一个上下文对象
    const context = createCodegenContext(ast, options)

    if (options.onContextCreated) options.onContextCreated(context)

    const {
        mode,
        push,
        prefixIdentifiers,
        indent,
        deindent,
        newline,
        scopeId,
        ssr
    } = context

    // 是否存在 helpers 辅助函数
    const helpers = Array.from(ast.helpers)
    const hasHelpers = helpers.length > 0
    // 使用 with 扩展作用域
    const useWithBlock = !prefixIdentifiers && mode !== 'module'
    const genScopeId = scopeId != null && mode === 'module' //!__BROWSER__ && 
    const isSetupInlined = !!options.inline  // !__BROWSER__ && 

    // setup() 模式下
    const preambleContext = isSetupInlined
        ? createCodegenContext(ast, options)
        : context

    // 2、生成预设代码
    // a、生成renderString开头部分
    if (mode === 'module') {
        // module:会通过 ES module 的 import 来导入 ast 中的 helpers 辅助函数，并用 export 默认导出 render 函数
        // 例：'import { createVNode as _createVNode, resolveDirective as _resolveDirective } from "vue"
        genModulePreamble(ast, preambleContext, genScopeId, isSetupInlined)
    } else {
        // function: 生成一个单一的 const { helpers... } = Vue 声明，并且 return 返回 render 函数，而不是通过 export 导出
        // 'const { createVNode: _createVNode, resolveDirective: _resolveDirective } = Vue
        genFunctionPreamble(ast, preambleContext)
    }

    // b、生成renderString的return函数
    // 生成后的函数名
    const functionName = ssr ? `ssrRender` : `render`
    // 函数的传参
    const args = ssr ? ['_ctx', '_push', '_parent', '_attrs'] : ['_ctx', '_cache']
    if (options.bindingMetadata && !options.inline) { // !__BROWSER__ && 
        // binding optimization args
        args.push('$props', '$setup', '$data', '$options')  // 添加参数
    }
    const signature =
        options.isTS // !__BROWSER__ && 
            ? args.map(arg => `${arg}: any`).join(',')
            : args.join(', ')

    // 3、生成渲染函数
    // 使用箭头函数还是函数声明来创建渲染函数
    if (isSetupInlined) {
        push(`(${signature}) => {`)
    } else {
        push(`function ${functionName}(${signature}) {`)
    }
    indent()

    // 使用 with 扩展作用域 
    if (useWithBlock) {
        push(`with (_ctx) {`)
        indent()
        // 在 function mode 中，const 声明应该在代码块中，
        // 并且应该重命名解构的变量，防止变量名和用户的变量名冲突
        if (hasHelpers) {
            push(`const { ${helpers.map(aliasHelper).join(', ')} } = _Vue`)
            push(`\n`)
            newline()
        }
    }
    // 如果 ast 中有组件，解析组件
    if (ast.components.length) {
        genAssets(ast.components, 'component', context)
        if (ast.directives.length || ast.temps > 0) {
            newline()
        }
    }
    // 生成自定义指令声明代码
    if (ast.directives.length) {
        genAssets(ast.directives, 'directive', context)
        if (ast.temps > 0) {
            newline()
        }
    }
    // Vue2 filters
    if (__COMPAT__ && ast.filters && ast.filters.length) {
        newline()
        genAssets(ast.filters, 'filter', context)
        newline()
    }
    // 4、生成资源声明代码
    // 生成临时变量代码
    if (ast.temps > 0) {
        push(`let `)
        for (let i = 0; i < ast.temps; i++) {
            push(`${i > 0 ? `, ` : ``}_temp${i}`)
        }
    }

    if (ast.components.length || ast.directives.length || ast.temps) {
        push(`\n`)
        newline()
    }
    // 5、生成创建 VNode 树的表达式
    if (!ssr) {
        push(`return `)
    }
    // 调用在转换期间生成的coegenNode，传入genNode，并在内部通过createVnode进行生成
    if (ast.codegenNode) {
        genNode(ast.codegenNode, context)
    } else {
        push(`null`)
    }

    if (useWithBlock) {
        deindent()
        push(`}`)
    }

    deindent()
    push(`}`)

    const result = {
        ast,
        code: context.code,
        preamble: isSetupInlined ? preambleContext.code : ``,
        // SourceMapGenerator does have toJSON() method but it's not in the types
        map: context.map ? (context.map as any).toJSON() : undefined
    }
    console.log(print(currentFilename, 'generate'), result)
    return result
}

// 生成代码生成器的上下文对象
function createCodegenContext(
    ast,
    {
        mode = 'function',
        prefixIdentifiers = mode === 'module',
        sourceMap = false,
        filename = `template.vue.html`,
        scopeId = null,
        optimizeImports = false,
        runtimeGlobalName = `Vue`,
        runtimeModuleName = `/@module/vue`, //`/node_modules/vue/dist/vue.runtime.esm-bundler.js`,// 
        ssrRuntimeModuleName = 'vue/server-renderer',
        ssr = false,
        isTS = false,
        inSSR = false
    }
): any {

    const context: any = {
        mode,
        prefixIdentifiers,
        sourceMap,
        filename,
        scopeId,
        optimizeImports,
        runtimeGlobalName,
        runtimeModuleName,
        ssrRuntimeModuleName,
        ssr,
        isTS,
        inSSR,
        source: ast.loc.source,
        code: ``, // 最终需要生成的代码
        column: 1,
        line: 1,
        offset: 0,
        indentLevel: 0,
        pure: false,
        map: undefined,

        // 生成期间需要调用的帮助函数
        helper(key) {
            return `_${helperNameMap[key]}`
        },
        // 并非是向数组中推送元素，而是拼接字符串
        // 当前的代码 context.code 后追加 code 来更新它的值
        push(code, node) {
            // 拼接 code
            context.code += code
            if (context.map) { // !__BROWSER__ && 
                if (node) {
                    let name
                    if (node.type === NodeTypes.SIMPLE_EXPRESSION && !node.isStatic) {
                        const content = node.content.replace(/^_ctx\./, '')
                        if (content !== node.content && isSimpleIdentifier(content)) {
                            name = content
                        }
                    }
                    addMapping(node.loc.start, name)
                }
                advancePositionWithMutation(context, code)
                if (node && node.loc !== locStub) {
                    addMapping(node.loc.end)
                }
            }
            // console.log(print(currentFilename, 'createCodegenContext->push', `拼接的code:${code}`), context.code)
        },
        // 增加代码的缩进，
        // 它会让上下文维护的代码缩进 context.indentLevel 加 1，
        // 内部会执行 newline 方法，添加一个换行符，以及两倍 indentLevel 对应的空格来表示缩进的长度
        indent() {  // 缩进
            newline(++context.indentLevel)
        },
        // 和 indent 相反，它会减少代码的缩进，让上下文维护的代码缩进 context.indentLevel 减 1，
        // 在内部会执行 newline 方法去添加一个换行符，
        // 并减少两倍 indentLevel 对应的空格的缩进长度
        deindent(withoutNewLine = false) {  // 回退缩进
            if (withoutNewLine) {
                --context.indentLevel
            } else {
                newline(--context.indentLevel)
            }
        },
        newline() { // 插入新的一行
            newline(context.indentLevel)
        }
    }

    function newline(n: number) {
        context.push('\n' + `  `.repeat(n))
    }

    //  生成对应的 sourceMap
    // 当生成器处理完 ast 树中的每个节点时，
    // 都会调用 push，向之前已经生成好的代码字符串中去拼接新生成的字符串
    //直至最终，拿到完整的代码字符串，并作为结果返回。
    function addMapping(loc: Position, name?: string) {
        context.map!.addMapping({
            name,
            source: context.filename,
            original: {
                line: loc.line,
                column: loc.column - 1 // source-map column is 0 based
            },
            generated: {
                line: context.line,
                column: context.column - 1
            }
        })
    }

    if (sourceMap) { // 
        // lazy require source-map implementation, only in non-browser builds
        context.map = new SourceMapGenerator()
        context.map!.setSourceContent(filename, context.source)
    }

    return context
}

// mode === 'module'
function genModulePreamble(
    ast,
    context,
    genScopeId: boolean,
    inline?: boolean
) {
    const { push, newline, optimizeImports, runtimeModuleName, ssrRuntimeModuleName } = context

    // 处理 scopeId
    if (genScopeId && ast.hoists.length) {
        ast.helpers.add(PUSH_SCOPE_ID)
        ast.helpers.add(POP_SCOPE_ID)
    }


    if (ast.helpers.size) {
        const helpers = Array.from(ast.helpers)
        // 生成 import 声明代码
        if (optimizeImports) {
            // when bundled with webpack with code-split, calling an import binding
            // as a function leads to it being wrapped with `Object(a.b)` or `(0,a.b)`,
            // incurring both payload size increase and potential perf overhead.
            // therefore we assign the imports to variables (which is a constant ~50b
            // cost per-component instead of scaling with template size)
            push(
                `import { ${helpers
                    // @ts-ignore
                    .map(s => helperNameMap[s])
                    .join(', ')} } from ${JSON.stringify(runtimeModuleName)}\n`
            )
            push(
                `\n// Binding optimization for webpack code-split\nconst ${helpers
                    // @ts-ignore
                    .map(s => `_${helperNameMap[s]} = ${helperNameMap[s]}`)
                    .join(', ')}\n`
            )
        } else {
            push(
                `import { ${helpers
                    // @ts-ignore
                    .map(s => `${helperNameMap[s]} as _${helperNameMap[s]}`)
                    .join(', ')} } from ${JSON.stringify(runtimeModuleName)}\n`
            )
        }
    }

    // 处理 ssrHelpers
    if (ast.ssrHelpers && ast.ssrHelpers.length) {
        push(
            `import { ${ast.ssrHelpers
                .map(s => `${helperNameMap[s]} as _${helperNameMap[s]}`)
                .join(', ')} } from "${ssrRuntimeModuleName}"\n`
        )
    }

    // 处理 imports
    if (ast.imports.length) {
        genImports(ast.imports, context)
        newline()
    }

    genHoists(ast.hoists, context)
    newline()

    if (!inline) {
        push(`export `)
    }
}


function genImports(importsOptions: any[], context: any) {
    if (!importsOptions.length) {
        return
    }
    importsOptions.forEach(imports => {
        context.push(`import `)
        genNode(imports.exp, context)
        context.push(` from '${imports.path}'`)
        context.newline()
    })
}

function isText(n: string | any) {
    return (
        isString(n) ||
        n.type === NodeTypes.SIMPLE_EXPRESSION ||
        n.type === NodeTypes.TEXT ||
        n.type === NodeTypes.INTERPOLATION ||
        n.type === NodeTypes.COMPOUND_EXPRESSION
    )
}

// mode === 'function'
// 生成renderString的头部
function genFunctionPreamble(ast, context) {
    const {
        ssr,
        prefixIdentifiers,
        push,
        newline,
        runtimeModuleName,
        runtimeGlobalName,
        ssrRuntimeModuleName
    } = context

    const VueBinding =
        ssr  //!__BROWSER__ && 
            ? `require(${JSON.stringify(runtimeModuleName)})`
            : runtimeGlobalName

    const helpers = Array.from(ast.helpers)

    // 生成const的结构声明，默认将生成在顶部
    if (helpers.length > 0) {
        if (prefixIdentifiers) { // !__BROWSER__ && 
            push(`const { ${helpers.map(aliasHelper).join(', ')} } = ${VueBinding}\n`)
        } else {
            // Vue最终生成的代码会被with包括，所以这里保存变量，避免冲突
            // const _Vue = Vue
            push(`const _Vue = ${VueBinding}\n`)
            // const { createElementVNode: _createElementVNode } = _Vue
            if (ast.hoists.length) {
                const staticHelpers = [
                    CREATE_VNODE,
                    CREATE_ELEMENT_VNODE,
                    CREATE_COMMENT,
                    CREATE_TEXT,
                    CREATE_STATIC
                ]
                    .filter(helper => helpers.includes(helper))
                    .map(aliasHelper)
                    .join(', ')
                push(`const { ${staticHelpers} } = _Vue\n`)
            }
        }
    }
    // 为SSR渲染生成代码
    if (ast.ssrHelpers && ast.ssrHelpers.length) { // !__BROWSER__ && 
        console.error(`SSR`,);
    }
    // 处理静态提升
    // ast.hoists为空数组，此方法直接return
    genHoists(ast.hoists, context)
    newline()
    push(`return `)
}

// 生成自定义组件声明代码
function genAssets(
    assets: string[],
    type: 'component' | 'directive' | 'filter',
    { helper, push, newline, isTS }: any
) {
    const resolver = helper(
        __COMPAT__ && type === 'filter'
            ? RESOLVE_FILTER
            : type === 'component'
                ? RESOLVE_COMPONENT
                : RESOLVE_DIRECTIVE
    )
    for (let i = 0; i < assets.length; i++) {
        let id = assets[i]
        // potential component implicit self-reference inferred from SFC filename
        const maybeSelfReference = id.endsWith('__self')
        if (maybeSelfReference) {
            id = id.slice(0, -6)
        }
        push(
            `const ${toValidAssetId(id, type)} = ${resolver}(${JSON.stringify(id)}${maybeSelfReference ? `, true` : ``
            })${isTS ? `!` : ``}`
        )
        if (i < assets.length - 1) {
            newline()
        }
    }
}

// 处理静态提升
function genHoists(hoists: any, context) {
    // 不需要静态提升
    if (!hoists.length) {
        return
    }

    // 存在需要提升 
    context.pure = true
    const { push, newline, helper, scopeId, mode } = context
    const genScopeId = scopeId != null && mode !== 'function'  // !__BROWSER__ && 
    newline()

    // 生成内连的 withScopeId 
    if (genScopeId) {
        push(
            `const _withScopeId = n => (${helper(
                PUSH_SCOPE_ID
            )}("${scopeId}"),n=n(),${helper(POP_SCOPE_ID)}(),n)`
        )
        newline()
    }

    // 遍历需要提升的变量
    for (let i = 0; i < hoists.length; i++) {
        const exp = hoists[i]
        if (exp) {
            const needScopeIdWrapper = genScopeId && exp.type === NodeTypes.VNODE_CALL
            // 根据数组的 index 生成静态提升的变量名 _hoisted_{index + 1}
            push(
                `const _hoisted_${i + 1} = ${needScopeIdWrapper ? `${PURE_ANNOTATION} _withScopeId(() => ` : ``
                }`
            )
            // 生成静态提升节点的代码字符串，赋值给之前声明的变量 _hoisted_{index + 1}。
            genNode(exp, context)
            if (needScopeIdWrapper) {
                push(`)`)
            }
            newline()
        }
    }
    // 在改回来
    context.pure = false
}

// 生成创建 VNode 树的表达式
function genNode(node: any | symbol | string, context: any) {
    // 如果是字符串，直接 push 入代码字符串
    if (isString(node)) {
        context.push(node)
        return
    }
    // 如果 node 是 symbol 类型，传入辅助函数生成的代码字符串
    if (isSymbol(node)) {
        context.push(context.helper(node))
        return
    }
    // 判断 node 类型
    switch (node.type) {
        case NodeTypes.ELEMENT:
        case NodeTypes.IF:
        case NodeTypes.FOR:
            __DEV__ &&
                assert(
                    node.codegenNode != null,
                    `Codegen node is missing for element/if/for node. ` +
                    `Apply appropriate transforms first.`
                )
            genNode(node.codegenNode!, context)
            break
        case NodeTypes.TEXT: // 文本节点
            genText(node, context)
            break
        case NodeTypes.SIMPLE_EXPRESSION:   // 简单表达式
            genExpression(node, context)
            break
        case NodeTypes.INTERPOLATION:
            genInterpolation(node, context)
            break
        case NodeTypes.TEXT_CALL:
            genNode(node.codegenNode, context)
            break
        case NodeTypes.COMPOUND_EXPRESSION:
            genCompoundExpression(node, context)
            break
        case NodeTypes.COMMENT:
            genComment(node, context)
            break
        case NodeTypes.VNODE_CALL:
            genVNodeCall(node, context)
            break

        case NodeTypes.JS_CALL_EXPRESSION:  // 方法
            genCallExpression(node, context)
            break
        case NodeTypes.JS_OBJECT_EXPRESSION: // props属性
            genObjectExpression(node, context)
            break
        case NodeTypes.JS_ARRAY_EXPRESSION:
            genArrayExpression(node, context)
            break
        case NodeTypes.JS_FUNCTION_EXPRESSION:
            genFunctionExpression(node, context)
            break
        case NodeTypes.JS_CONDITIONAL_EXPRESSION:
            genConditionalExpression(node, context)
            break
        case NodeTypes.JS_CACHE_EXPRESSION:
            genCacheExpression(node, context)
            break
        case NodeTypes.JS_BLOCK_STATEMENT:
            genNodeList(node.body, context, true, false)
            break

        // SSR only types
        case NodeTypes.JS_TEMPLATE_LITERAL:
            genTemplateLiteral(node, context) //!__BROWSER__ && 
            break
        case NodeTypes.JS_IF_STATEMENT:
            genIfStatement(node, context)  // !__BROWSER__ && 
            break
        case NodeTypes.JS_ASSIGNMENT_EXPRESSION:
            genAssignmentExpression(node, context) // !__BROWSER__ && 
            break
        case NodeTypes.JS_SEQUENCE_EXPRESSION:
            genSequenceExpression(node, context) // !__BROWSER__ && 
            break
        case NodeTypes.JS_RETURN_STATEMENT:
            genReturnStatement(node, context) // !__BROWSER__ && 
            break

        /* istanbul ignore next */
        case NodeTypes.IF_BRANCH:
            // noop
            break
        default:
            if (__DEV__) {
                assert(false, `unhandled codegen node type: ${(node as any).type}`)
                // make sure we exhaust all possible types
                // const exhaustiveCheck: never = node
                return node
            }
    }
}


function genNodeList(
    nodes: (string | symbol | any[])[],
    context: any,
    multilines: boolean = false,
    comma: boolean = true
) {
    const { push, newline } = context
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (isString(node)) {
            push(node)
        } else if (isArray(node)) {
            genNodeListAsArray(node, context)
        } else {
            genNode(node, context)
        }
        if (i < nodes.length - 1) {
            if (multilines) {
                comma && push(',')
                newline()
            } else {
                comma && push(', ')
            }
        }
    }
}


function genNodeListAsArray(
    nodes: (string | any[])[],
    context: any
) {
    const multilines =
        nodes.length > 3 ||
        ((!__BROWSER__ || __DEV__) && nodes.some(n => isArray(n) || !isText(n)))
    context.push(`[`)
    multilines && context.indent()
    genNodeList(nodes, context, multilines)
    multilines && context.deindent()
    context.push(`]`)
}

// 文本节点
function genText(node: any, context) {
    context.push(JSON.stringify(node.content), node)
}

// 简单表达式
function genExpression(node: any, context) {
    const { content, isStatic } = node
    // 如果是静态的，则通过 JSON 字符串序列化后拼入代码字符串，否则直接拼接表达式对应的 content。
    context.push(isStatic ? JSON.stringify(content) : content, node)
}

// 动态数据节点
function genInterpolation(node: any, context: any) {
    const { push, helper, pure } = context
    if (pure) push(PURE_ANNOTATION)
    // 首先push累计字符串"_toDisplayString("
    push(`${helper(TO_DISPLAY_STRING)}(`)
    genNode(node.content, context)
    push(`)`)
}

// 方法定义
function genCompoundExpression(
    node: any,
    context: any
) {
    // 循环传入的node.children数组
    // 如果是字符串则直接调用push方法进行字符串累加，否则调用genNode方法依次解析
    for (let i = 0; i < node.children!.length; i++) {
        const child = node.children![i]
        if (isString(child)) {
            context.push(child)
        } else {
            genNode(child, context)
        }
    }
}

// 注释节点
function genComment(node: any, context: any) {
    const { push, helper, pure } = context
    if (pure) {
        push(PURE_ANNOTATION)
    }
    push(`${helper(CREATE_COMMENT)}(${JSON.stringify(node.content)})`, node)
}

function genExpressionAsPropertyKey(
    node: any,
    context: any
) {
    const { push } = context
    if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
        push(`[`)
        genCompoundExpression(node, context)
        push(`]`)
    } else if (node.isStatic) {
        // only quote keys if necessary
        const text = isSimpleIdentifier(node.content)
            ? node.content
            : JSON.stringify(node.content)
        push(text, node)
    } else {
        push(`[${node.content}]`, node)
    }
}


function genVNodeCall(node: any, context: any) {
    const { push, helper, pure } = context
    const {
        tag,
        props,
        children,
        patchFlag,
        dynamicProps,
        directives,
        isBlock,
        disableTracking,
        isComponent
    } = node
    if (directives) {
        push(helper(WITH_DIRECTIVES) + `(`)
    }
    if (isBlock) {
        push(`(${helper(OPEN_BLOCK)}(${disableTracking ? `true` : ``}), `)
    }
    if (pure) {
        push(PURE_ANNOTATION)
    }
    const callHelper: symbol = isBlock
        ? getVNodeBlockHelper(context.inSSR, isComponent)
        : getVNodeHelper(context.inSSR, isComponent)
    push(helper(callHelper) + `(`, node)
    genNodeList(
        genNullableArgs([tag, props, children, patchFlag, dynamicProps]),
        context
    )
    push(`)`)
    if (isBlock) {
        push(`)`)
    }
    if (directives) {
        push(`, `)
        genNode(directives, context)
        push(`)`)
    }
}

function genNullableArgs(args: any[]): any {
    let i = args.length
    while (i--) {
        if (args[i] != null) break
    }
    return args.slice(0, i + 1).map(arg => arg || `null`)
}

// 方法定义
function genCallExpression(node: any, context: any) {
    const { push, helper, pure } = context
    const callee = isString(node.callee) ? node.callee : helper(node.callee)
    if (pure) {
        push(PURE_ANNOTATION)
    }
    push(callee + `(`, node)
    genNodeList(node.arguments, context)
    push(`)`)
}


function genObjectExpression(node: any, context: any) {
    const { push, indent, deindent, newline } = context
    const { properties } = node
    if (!properties.length) {
        push(`{}`, node)
        return
    }
    const multilines =
        properties.length > 1 ||
        ((!__BROWSER__ || __DEV__) &&
            properties.some(p => p.value.type !== NodeTypes.SIMPLE_EXPRESSION))
    push(multilines ? `{` : `{ `)
    multilines && indent()
    for (let i = 0; i < properties.length; i++) {
        const { key, value } = properties[i]
        // key
        genExpressionAsPropertyKey(key, context)
        push(`: `)
        // value
        genNode(value, context)
        if (i < properties.length - 1) {
            // will only reach this if it's multilines
            push(`,`)
            newline()
        }
    }
    multilines && deindent()
    push(multilines ? `}` : ` }`)
}

function genArrayExpression(node: any, context: any) {
    genNodeListAsArray(node.elements as any[], context)
}

function genFunctionExpression(
    node: any,
    context: any
) {
    const { push, indent, deindent } = context
    const { params, returns, body, newline, isSlot } = node
    if (isSlot) {
        // wrap slot functions with owner context
        push(`_${helperNameMap[WITH_CTX]}(`)
    }
    push(`(`, node)
    if (isArray(params)) {
        genNodeList(params, context)
    } else if (params) {
        genNode(params, context)
    }
    push(`) => `)
    if (newline || body) {
        push(`{`)
        indent()
    }
    if (returns) {
        if (newline) {
            push(`return `)
        }
        if (isArray(returns)) {
            genNodeListAsArray(returns, context)
        } else {
            genNode(returns, context)
        }
    } else if (body) {
        genNode(body, context)
    }
    if (newline || body) {
        deindent()
        push(`}`)
    }
    if (isSlot) {
        if (__COMPAT__ && node.isNonScopedSlot) {
            push(`, undefined, true`)
        }
        push(`)`)
    }
}

function genConditionalExpression(
    node: any,
    context: any
) {
    const { test, consequent, alternate, newline: needNewline } = node
    const { push, indent, deindent, newline } = context
    if (test.type === NodeTypes.SIMPLE_EXPRESSION) {
        const needsParens = !isSimpleIdentifier(test.content)
        needsParens && push(`(`)
        genExpression(test, context)
        needsParens && push(`)`)
    } else {
        push(`(`)
        genNode(test, context)
        push(`)`)
    }
    needNewline && indent()
    context.indentLevel++
    needNewline || push(` `)
    push(`? `)
    genNode(consequent, context)
    context.indentLevel--
    needNewline && newline()
    needNewline || push(` `)
    push(`: `)
    const isNested = alternate.type === NodeTypes.JS_CONDITIONAL_EXPRESSION
    if (!isNested) {
        context.indentLevel++
    }
    genNode(alternate, context)
    if (!isNested) {
        context.indentLevel--
    }
    needNewline && deindent(true /* without newline */)
}

function genCacheExpression(node: any, context: any) {
    const { push, helper, indent, deindent, newline } = context
    push(`_cache[${node.index}] || (`)
    if (node.isVNode) {
        indent()
        push(`${helper(SET_BLOCK_TRACKING)}(-1),`)
        newline()
    }
    push(`_cache[${node.index}] = `)
    genNode(node.value, context)
    if (node.isVNode) {
        push(`,`)
        newline()
        push(`${helper(SET_BLOCK_TRACKING)}(1),`)
        newline()
        push(`_cache[${node.index}]`)
        deindent()
    }
    push(`)`)
}

function genTemplateLiteral(node: any, context: any) {
    const { push, indent, deindent } = context
    push('`')
    const l = node.elements.length
    const multilines = l > 3
    for (let i = 0; i < l; i++) {
        const e = node.elements[i]
        if (isString(e)) {
            push(e.replace(/(`|\$|\\)/g, '\\$1'))
        } else {
            push('${')
            if (multilines) indent()
            genNode(e, context)
            if (multilines) deindent()
            push('}')
        }
    }
    push('`')
}

function genIfStatement(node: any, context: any) {
    const { push, indent, deindent } = context
    const { test, consequent, alternate } = node
    push(`if (`)
    genNode(test, context)
    push(`) {`)
    indent()
    genNode(consequent, context)
    deindent()
    push(`}`)
    if (alternate) {
        push(` else `)
        if (alternate.type === NodeTypes.JS_IF_STATEMENT) {
            genIfStatement(alternate, context)
        } else {
            push(`{`)
            indent()
            genNode(alternate, context)
            deindent()
            push(`}`)
        }
    }
}

function genAssignmentExpression(
    node: any,
    context: any
) {
    genNode(node.left, context)
    context.push(` = `)
    genNode(node.right, context)
}

function genSequenceExpression(
    node: any,
    context: any
) {
    context.push(`(`)
    genNodeList(node.expressions, context)
    context.push(`)`)
}

function genReturnStatement(
    { returns }: any,
    context: any
) {
    context.push(`return `)
    if (isArray(returns)) {
        genNodeListAsArray(returns, context)
    } else {
        genNode(returns, context)
    }
}
