import { PatchFlagNames, PatchFlags, camelize, capitalize, isBuiltInDirective, isObject, isOn, isReservedProp, isSymbol, print } from "@vue/shared";
import { ConstantTypes, ElementTypes, NodeTypes, VNodeCall, createArrayExpression, createCallExpression, createObjectExpression, createObjectProperty, createSimpleExpression, createVNodeCall } from "../ast";
import { TELEPORT, SUSPENSE, RESOLVE_DYNAMIC_COMPONENT, TO_HANDLERS, MERGE_PROPS, NORMALIZE_CLASS, NORMALIZE_STYLE, NORMALIZE_PROPS, GUARD_REACTIVE_PROPS, RESOLVE_DIRECTIVE, UNREF, KEEP_ALIVE } from "../runtimeHelpers";
import { CompilerDeprecationTypes, isCompatEnabled } from "../compat/compatConfig";
import { getInnerRange, isStaticArgOf, isStaticExp, toValidAssetId } from "../utils";
import { ErrorCodes, createCompilerError } from "../errors";
import { BindingTypes } from "../options";
import { getConstantType } from "./hoistStatic";
import { buildSlots } from "./vSlot";

const currentFilename = 'compiler-core/transforms/transformElement.ts'

// 对所有元素标签进行转换，包括html标签以及组件
export const transformElement = (node: any, context: any) => {
  //在所有子表达式都完成之后，在退出时执行工作
  return function postTransformElement() {
    // 如果不是元素或组件就直接退出，比如文字会直接退出，if，for等节点转换后type都不为1，所以会跳过
    node = context.currentNode!
    if (
      !(
        node.type === NodeTypes.ELEMENT &&
        (node.tagType === ElementTypes.ELEMENT ||
          node.tagType === ElementTypes.COMPONENT)
      )
    ) {
      return
    }

    // tag 为 html元素的标签，props为属性值比如id，on（事件）等
    const { tag, props } = node
    const isComponent = node.tagType === ElementTypes.COMPONENT

    // 转换的目标是创建一个实现
    // VNodeCall接口
    let vnodeTag = isComponent
      ? resolveComponentType(node as any, context)
      : `"${tag}"`

    const isDynamicComponent =
      isObject(vnodeTag) && vnodeTag.callee === RESOLVE_DYNAMIC_COMPONENT

    let vnodeProps: VNodeCall['props']
    let vnodeChildren: VNodeCall['children']
    let vnodePatchFlag: VNodeCall['patchFlag']
    let patchFlag: number = 0
    let vnodeDynamicProps: VNodeCall['dynamicProps']
    let dynamicPropNames: string[] | undefined
    let vnodeDirectives: VNodeCall['directives']

    let shouldUseBlock =
      // dynamic component may resolve to plain elements
      isDynamicComponent ||
      // @ts-ignore
      vnodeTag === TELEPORT ||
      // @ts-ignore
      vnodeTag === SUSPENSE ||
      (!isComponent &&
        // <svg> and <foreignObject> must be forced into blocks so that block
        // updates inside get proper isSVG flag at runtime. (#639, #643)
        // This is technically web-specific, but splitting the logic out of core
        // leads to too much unnecessary complexity.
        (tag === 'svg' || tag === 'foreignObject'))

    // 元素上的属性 现在 props
    if (props.length > 0) {
      // 构建属性，并且根据属性计算patchFlag
      // 检测节点属性的动态部分
      // 小小的函数 属实 复杂
      const propsBuildResult = buildProps(
        node,
        context,
        undefined,
        isComponent,
        isDynamicComponent
      )
      // 获取属性值
      vnodeProps = propsBuildResult.props
      // 获取修补flag
      patchFlag = propsBuildResult.patchFlag
      // 获取动态节点属性
      dynamicPropNames = propsBuildResult.dynamicPropNames
      const directives = propsBuildResult.directives
      vnodeDirectives =
        directives && directives.length
          ? (createArrayExpression(
            directives.map(dir => buildDirectiveArgs(dir, context))
          ) as any)
          : undefined

      if (propsBuildResult.shouldUseBlock) {
        shouldUseBlock = true
      }
    }

    // children
    if (node.children.length > 0) {
      // keep-alive的处理
      // @ts-ignore
      if (vnodeTag === KEEP_ALIVE) {
        console.error(`vnodeTag === KEEP_ALIVE`,);
      }
      const shouldBuildAsSlots =
        isComponent &&
        // Teleport is not a real component and has dedicated runtime handling
        // @ts-ignore
        vnodeTag !== TELEPORT &&
        // explained above.
        // @ts-ignore
        vnodeTag !== KEEP_ALIVE

      if (shouldBuildAsSlots) {
        const { slots, hasDynamicSlots } = buildSlots(node, context)
        vnodeChildren = slots
        if (hasDynamicSlots) {
          patchFlag |= PatchFlags.DYNAMIC_SLOTS
        }
      }
      // 如果只有一个子节点，并且不是TELEPORT
      // @ts-ignore
      else if (node.children.length === 1 && vnodeTag !== TELEPORT) {
        // 获取子节点
        const child = node.children[0]
        const type = child.type
        // 子节点是否是动态文字，看类型是否是插值，或者是插值和静态的组合
        // {{name}} 这种是type为5的插值类型， hello {{name}} 会在text转换中转换为 type为8的组合表达式
        // 这两种均为动态的子节点
        const hasDynamicTextChild =
          type === NodeTypes.INTERPOLATION ||
          type === NodeTypes.COMPOUND_EXPRESSION
        if (
          hasDynamicTextChild &&
          // 获取常量类型，更新patchFlag
          getConstantType(child, context) === ConstantTypes.NOT_CONSTANT
        ) {
          // patchFlag = patchFlag | 1 patchFlag 与 0001 按照位或运算，为之后patch过程做优化
          patchFlag |= PatchFlags.TEXT
        }
        // pass directly if the only child is a text node
        // (plain / interpolation / expression)
        if (hasDynamicTextChild || type === NodeTypes.TEXT) {
          vnodeChildren = child as any
        } else {
          vnodeChildren = node.children
        }
      } else {
        vnodeChildren = node.children
      }
    }
    // 动态节点
    if (patchFlag !== 0) {
      if (__DEV__) {
        if (patchFlag < 0) {
          // special flags (negative and mutually exclusive)
          vnodePatchFlag =
            patchFlag + ` /* ${PatchFlagNames[patchFlag as PatchFlags]} */`
        } else {
          // bitwise flags 按位获取pathch flag 
          // PatchFlagNames 为以下值
          // [1 /* TEXT */]: `TEXT`,
          // [2 /* CLASS */]: `CLASS`,
          // [4 /* STYLE */]: `STYLE`,
          // [8 /* PROPS */]: `PROPS`,
          // [16 /* FULL_PROPS */]: `FULL_PROPS`,
          // [32 /* HYDRATE_EVENTS */]: `HYDRATE_EVENTS`,
          // [64 /* STABLE_FRAGMENT */]: `STABLE_FRAGMENT`,
          // [128 /* KEYED_FRAGMENT */]: `KEYED_FRAGMENT`,
          // [256 /* UNKEYED_FRAGMENT */]: `UNKEYED_FRAGMENT`,
          // [512 /* NEED_PATCH */]: `NEED_PATCH`,
          // [1024 /* DYNAMIC_SLOTS */]: `DYNAMIC_SLOTS`,
          // [2048 /* DEV_ROOT_FRAGMENT */]: `DEV_ROOT_FRAGMENT`,
          // [-1 /* HOISTED */]: `HOISTED`,
          // [-2 /* BAIL */]: `BAIL`
          // 这里其实就是获取到底该元素有多少种patchFlag，上面合并patchFlag用的是|运算，这里解的时候
          // 用&运算，就知道上面到底合并了多少种
          // 如果patchFlag为9 从上表中我们能知道是1+8也就是text和props的组合 1000 | 0001 = 1001 （9）
          // 我们拆解时做 & 运算 1001 & 0001 = 0001 所以得到 这里包含 text 
          // 1001 & 1000 = 1000 如果和class做运算 1001 & 0010 = 0000 这里filter条件就为false
          // 所以就通过这种巧妙地方式进行合并和拆解。
          const flagNames = Object.keys(PatchFlagNames)
            .map(Number)
            .filter(n => n > 0 && patchFlag & n)
            .map(n => PatchFlagNames[n as PatchFlags])
            .join(`, `)
          vnodePatchFlag = patchFlag + ` /* ${flagNames} */`
        }
      } else {
        vnodePatchFlag = String(patchFlag)
      }
      if (dynamicPropNames && dynamicPropNames.length) {
        vnodeDynamicProps = stringifyDynamicPropNames(dynamicPropNames)
      }
    }

    const result = createVNodeCall(
      context,
      vnodeTag,
      vnodeProps,
      vnodeChildren,
      vnodePatchFlag,
      vnodeDynamicProps,
      vnodeDirectives,
      !!shouldUseBlock,
      false /* disableTracking */,
      isComponent,
      node.loc
    )

    console.log(print(currentFilename, 'transformElement'), result)
    // 创建生成node节点的对象
    // 在这里添加type，patchFlag，isBlock等属性
    node.codegenNode = result
  }
}

export function resolveComponentType(
  node,
  context,
  ssr = false
) {

  let { tag } = node

  console.error(`resolveComponentType`, tag);
}

// 指令map
const directiveImportMap = new WeakMap<any, symbol>()

// 构建属性，并且根据属性计算patchFlag
// 检测节点属性的动态部分
export function buildProps(
  node: any,
  context: any,
  props = node.props,
  isComponent: boolean,
  isDynamicComponent: boolean,
  ssr = false
) {

  const { tag, loc: elementLoc, children } = node
  // 存放 静态属性
  let properties = []
  // 表达式
  const mergeArgs = []
  // 指令
  const runtimeDirectives = []
  // 存在 children
  const hasChildren = children.length > 0
  let shouldUseBlock = false

  // patchFlag analysis
  let patchFlag = 0
  let hasRef = false
  let hasClassBinding = false
  let hasStyleBinding = false
  let hasHydrationEventBinding = false
  let hasDynamicKeys = false
  let hasVnodeHook = false
  const dynamicPropNames: string[] = []

  const pushMergeArg = (arg?: any) => {
    if (properties.length) {
      mergeArgs.push(
        createObjectExpression(dedupeProperties(properties), elementLoc)
      )
      properties = []
    }
    if (arg) mergeArgs.push(arg)
  }
  const analyzePatchFlag = ({ key, value }) => {
    if (isStaticExp(key)) {
      const name = key.content
      const isEventHandler = isOn(name)
      if (
        isEventHandler &&
        (!isComponent || isDynamicComponent) &&
        // omit the flag for click handlers because hydration gives click
        // dedicated fast path.
        name.toLowerCase() !== 'onclick' &&
        // omit v-model handlers
        name !== 'onUpdate:modelValue' &&
        // omit onVnodeXXX hooks
        !isReservedProp(name)
      ) {
        hasHydrationEventBinding = true
      }

      if (isEventHandler && isReservedProp(name)) {
        hasVnodeHook = true
      }

      if (
        value.type === NodeTypes.JS_CACHE_EXPRESSION ||
        ((value.type === NodeTypes.SIMPLE_EXPRESSION ||
          value.type === NodeTypes.COMPOUND_EXPRESSION) &&
          getConstantType(value, context) > 0)
      ) {
        // skip if the prop is a cached handler or has constant value
        return
      }

      if (name === 'ref') {
        hasRef = true
      } else if (name === 'class') {
        hasClassBinding = true
      } else if (name === 'style') {
        hasStyleBinding = true
      } else if (name !== 'key' && !dynamicPropNames.includes(name)) {
        dynamicPropNames.push(name)
      }

      // treat the dynamic class and style binding of the component as dynamic props
      if (
        isComponent &&
        (name === 'class' || name === 'style') &&
        !dynamicPropNames.includes(name)
      ) {
        dynamicPropNames.push(name)
      }
    } else {
      hasDynamicKeys = true
    }
  }

  // 对 静态属性 存放  properties
  // 各种内置指令 自定义指令  存放 runtimeDirectives
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    // 静态节点
    // 例：id = "xx" class="ddd"
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const { loc, name, value } = prop
      let isStatic = true
      if (name === 'ref') {
        console.error(`name === 'ref'`,);
      }
      // skip is on <component>, or is="vue:xxx"
      if (
        name === 'is' &&
        // component
        (isComponentTag(tag) ||
          (value && value.content.startsWith('vue:')) ||
          (__COMPAT__ &&
            isCompatEnabled(
              CompilerDeprecationTypes.COMPILER_IS_ON_ELEMENT,
              context
            )))
      ) {
        continue
      }
      // name = id、class
      properties.push(
        createObjectProperty(
          createSimpleExpression(
            name,
            true,
            getInnerRange(loc, 0, name.length)
          ),
          createSimpleExpression(
            value ? value.content : '',
            isStatic,
            value ? value.loc : loc
          )
        )
      )
    }
    // 指令 
    else {
      const { name, arg, exp, loc } = prop
      const isVBind = name === 'bind'
      const isVOn = name === 'on'
      // slot
      if (name === 'slot') {
        if (!isComponent) {
          context.onError(
            createCompilerError(ErrorCodes.X_V_SLOT_MISPLACED, loc)
          )
        }
        continue
      }
      // once memo
      if (name === 'once' || name === 'memo') {
        continue
      }
      //  v-is and :is on <component>
      if (
        name === 'is' ||
        (isVBind &&
          isStaticArgOf(arg, 'is') &&
          (isComponentTag(tag) ||
            (__COMPAT__ &&
              isCompatEnabled(
                CompilerDeprecationTypes.COMPILER_IS_ON_ELEMENT,
                context
              ))))
      ) {
        continue
      }
      // ssr
      if (isVOn && ssr) {
        continue
      }

      // 动态健的元素强制放入块中
      if (
        // #938: elements with dynamic keys should be forced into blocks
        (isVBind && isStaticArgOf(arg, 'key')) ||
        // inline before-update hooks need to force block so that it is invoked
        // before children
        (isVOn && hasChildren && isStaticArgOf(arg, 'vue:before-update'))
      ) {
        shouldUseBlock = true
      }

      // v-bind
      if (isVBind && isStaticArgOf(arg, 'ref') && context.scopes.vFor > 0) {
        properties.push(
          createObjectProperty(
            createSimpleExpression('ref_for', true),
            createSimpleExpression('true')
          )
        )
      }

      // 无参数的v-bind和v-on的特殊情况
      if (!arg && (isVBind || isVOn)) {
        hasDynamicKeys = true
        // <p :class="['class','ddd']">hello，{{name}}</p>
        // { 
        //   constType: 0
        //   content: "['class','ddd']"
        //   isStatic: false
        //   loc: {start: {…}, end: {…}, source: "['class','ddd']"}
        //   type: 4
        // }
        if (exp) {
          if (isVBind) {
            // 提前合并 以进行compat内部版本检查
            pushMergeArg()
            if (__COMPAT__) { }
            mergeArgs.push(exp)
          } else {
            // v-on="obj" -> toHandlers(obj)
            pushMergeArg({
              type: NodeTypes.JS_CALL_EXPRESSION,
              loc,
              callee: context.helper(TO_HANDLERS),
              arguments: isComponent ? [exp] : [exp, `true`]
            })
          }
        } else {
          context.onError(
            createCompilerError(
              isVBind
                ? ErrorCodes.X_V_BIND_NO_EXPRESSION
                : ErrorCodes.X_V_ON_NO_EXPRESSION,
              loc
            )
          )
        }
        continue
      }

      const directiveTransform = context.directiveTransforms[name]
      if (directiveTransform) {
        //具有内置的指令转换。
        // v-on v-bind
        // 这段相当复杂
        let { props, needRuntime } = directiveTransform(prop, node, context)
        !ssr && props.forEach(analyzePatchFlag)
        if (isVOn && arg && !isStaticExp(arg)) {
          pushMergeArg(createObjectExpression(props, elementLoc))
        } else {
          properties.push(...props)
        }
        if (needRuntime) {
          runtimeDirectives.push(prop)
          if (isSymbol(needRuntime)) {
            directiveImportMap.set(prop, needRuntime)
          }
        }
      }
      // 不存在 'bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo'
      // 自定义指令
      else if (!isBuiltInDirective(name)) {
        runtimeDirectives.push(prop)
        // 自定义目录可能使用beforeUpdate，因此需要强制阻止
        // 以确保在子项更新之前调用更新之前
        // 存在 children
        if (hasChildren) {
          shouldUseBlock = true
        }
      }
    }
  }

  let propsExpression: any | undefined = undefined

  // v-bind="object" or v-on="object" 用 mergeProps
  if (mergeArgs.length) {
    // close up any not-yet-merged props
    pushMergeArg()
    if (mergeArgs.length > 1) {
      propsExpression = createCallExpression(
        context.helper(MERGE_PROPS),
        mergeArgs,
        elementLoc
      )
    } else {
      // single v-bind with nothing else - no need for a mergeProps call
      propsExpression = mergeArgs[0]
    }
  } else if (properties.length) {
    propsExpression = createObjectExpression(
      dedupeProperties(properties),
      elementLoc
    )
  }

  // patchFlag analysis
  if (hasDynamicKeys) {
    patchFlag |= PatchFlags.FULL_PROPS
  } else {
    if (hasClassBinding && !isComponent) {
      patchFlag |= PatchFlags.CLASS
    }
    if (hasStyleBinding && !isComponent) {
      patchFlag |= PatchFlags.STYLE
    }
    if (dynamicPropNames.length) {
      patchFlag |= PatchFlags.PROPS
    }
    if (hasHydrationEventBinding) {
      patchFlag |= PatchFlags.HYDRATE_EVENTS
    }
  }
  if (
    !shouldUseBlock &&
    (patchFlag === 0 || patchFlag === PatchFlags.HYDRATE_EVENTS) &&
    (hasRef || hasVnodeHook || runtimeDirectives.length > 0)
  ) {
    patchFlag |= PatchFlags.NEED_PATCH
  }

  // pre-normalize props , 暂时跳过SSR
  if (!context.inSSR && propsExpression) {
    switch (propsExpression.type) {
      case NodeTypes.JS_OBJECT_EXPRESSION:
        // means that there is no v-bind,
        // but still need to deal with dynamic key binding
        let classKeyIndex = -1
        let styleKeyIndex = -1
        let hasDynamicKey = false

        for (let i = 0; i < propsExpression.properties.length; i++) {
          const key = propsExpression.properties[i].key
          if (isStaticExp(key)) {
            if (key.content === 'class') {
              classKeyIndex = i
            } else if (key.content === 'style') {
              styleKeyIndex = i
            }
          } else if (!key.isHandlerKey) {
            hasDynamicKey = true
          }
        }

        const classProp = propsExpression.properties[classKeyIndex]
        const styleProp = propsExpression.properties[styleKeyIndex]

        // no dynamic key
        if (!hasDynamicKey) {
          if (classProp && !isStaticExp(classProp.value)) {
            classProp.value = createCallExpression(
              context.helper(NORMALIZE_CLASS),
              [classProp.value]
            )
          }
          if (
            styleProp &&
            // the static style is compiled into an object,
            // so use `hasStyleBinding` to ensure that it is a dynamic style binding
            (hasStyleBinding ||
              (styleProp.value.type === NodeTypes.SIMPLE_EXPRESSION &&
                styleProp.value.content.trim()[0] === `[`) ||
              // v-bind:style and style both exist,
              // v-bind:style with static literal object
              styleProp.value.type === NodeTypes.JS_ARRAY_EXPRESSION)
          ) {
            styleProp.value = createCallExpression(
              context.helper(NORMALIZE_STYLE),
              [styleProp.value]
            )
          }
        } else {
          // dynamic key binding, wrap with `normalizeProps`
          propsExpression = createCallExpression(
            context.helper(NORMALIZE_PROPS),
            [propsExpression]
          )
        }
        break
      case NodeTypes.JS_CALL_EXPRESSION:
        // mergeProps call, do nothing
        break
      default:
        // single v-bind
        propsExpression = createCallExpression(
          context.helper(NORMALIZE_PROPS),
          [
            createCallExpression(context.helper(GUARD_REACTIVE_PROPS), [
              propsExpression
            ])
          ]
        )
        break
    }
  }

  const result = {
    props: propsExpression,
    directives: runtimeDirectives,
    patchFlag,
    dynamicPropNames,
    shouldUseBlock
  }

  console.log(print(currentFilename, 'buildProps()'), result)
  return result
}


// Dedupe props in an object literal.
// Literal duplicated attributes would have been warned during the parse phase,
// however, it's possible to encounter duplicated `onXXX` handlers with different
// modifiers. We also need to merge static and dynamic class / style attributes.
// - onXXX handlers / style: merge into array
// - class: merge into single expression with concatenation
function dedupeProperties(properties) {
  const knownProps: Map<string, any> = new Map()
  const deduped = []
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i]
    // dynamic keys are always allowed
    if (prop.key.type === NodeTypes.COMPOUND_EXPRESSION || !prop.key.isStatic) {
      deduped.push(prop)
      continue
    }
    const name = prop.key.content
    const existing = knownProps.get(name)
    if (existing) {
      if (name === 'style' || name === 'class' || isOn(name)) {
        mergeAsArray(existing, prop)
      }
      // unexpected duplicate, should have emitted error during parse
    } else {
      knownProps.set(name, prop)
      deduped.push(prop)
    }
  }
  return deduped
}

function mergeAsArray(existing, incoming) {
  if (existing.value.type === NodeTypes.JS_ARRAY_EXPRESSION) {
    existing.value.elements.push(incoming.value)
  } else {
    existing.value = createArrayExpression(
      [existing.value, incoming.value],
      existing.loc
    )
  }
}

function resolveSetupReference(name: string, context: any) {
  const bindings = context.bindingMetadata
  if (!bindings || bindings.__isScriptSetup === false) {
    return
  }

  const camelName = camelize(name)
  const PascalName = capitalize(camelName)
  const checkType = (type: any) => {
    if (bindings[name] === type) {
      return name
    }
    if (bindings[camelName] === type) {
      return camelName
    }
    if (bindings[PascalName] === type) {
      return PascalName
    }
  }

  const fromConst =
    checkType(BindingTypes.SETUP_CONST) ||
    checkType(BindingTypes.SETUP_REACTIVE_CONST) ||
    checkType(BindingTypes.LITERAL_CONST)
  if (fromConst) {
    return context.inline
      ? // in inline mode, const setup bindings (e.g. imports) can be used as-is
      fromConst
      : `$setup[${JSON.stringify(fromConst)}]`
  }

  const fromMaybeRef =
    checkType(BindingTypes.SETUP_LET) ||
    checkType(BindingTypes.SETUP_REF) ||
    checkType(BindingTypes.SETUP_MAYBE_REF)
  if (fromMaybeRef) {
    return context.inline
      ? // setup scope bindings that may be refs need to be unrefed
      `${context.helperString(UNREF)}(${fromMaybeRef})`
      : `$setup[${JSON.stringify(fromMaybeRef)}]`
  }
}

export function buildDirectiveArgs(
  dir: any,
  context: any
): any {
  const dirArgs = []
  const runtime = directiveImportMap.get(dir)
  if (runtime) {
    // built-in directive with runtime
    dirArgs.push(context.helperString(runtime))
  } else {
    // user directive.
    // see if we have directives exposed via <script setup>
    const fromSetup =
      !__BROWSER__ && resolveSetupReference('v-' + dir.name, context)
    if (fromSetup) {
      dirArgs.push(fromSetup)
    } else {
      // inject statement for resolving directive
      context.helper(RESOLVE_DIRECTIVE)
      context.directives.add(dir.name)
      dirArgs.push(toValidAssetId(dir.name, `directive`))
    }
  }
  const { loc } = dir
  if (dir.exp) dirArgs.push(dir.exp)
  if (dir.arg) {
    if (!dir.exp) {
      dirArgs.push(`void 0`)
    }
    dirArgs.push(dir.arg)
  }
  if (Object.keys(dir.modifiers).length) {
    if (!dir.arg) {
      if (!dir.exp) {
        dirArgs.push(`void 0`)
      }
      dirArgs.push(`void 0`)
    }
    const trueExpression = createSimpleExpression(`true`, false, loc)
    dirArgs.push(
      createObjectExpression(
        dir.modifiers.map(modifier =>
          createObjectProperty(modifier, trueExpression)
        ),
        loc
      )
    )
  }
  return createArrayExpression(dirArgs, dir.loc)
}

function stringifyDynamicPropNames(props: string[]): string {
  let propsNamesString = `[`
  for (let i = 0, l = props.length; i < l; i++) {
    propsNamesString += JSON.stringify(props[i])
    if (i < l - 1) propsNamesString += ', '
  }
  return propsNamesString + `]`
}

function isComponentTag(tag: string) {
  return tag === 'component' || tag === 'Component'
}
