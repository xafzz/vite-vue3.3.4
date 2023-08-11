import { PatchFlags, isArray, isString, isSymbol, print } from "@vue/shared";
import { ConstantTypes, ElementTypes, NodeTypes, VNodeCall, createArrayExpression, getVNodeBlockHelper, getVNodeHelper } from "../ast";
import { GUARD_REACTIVE_PROPS, NORMALIZE_CLASS, NORMALIZE_STYLE, OPEN_BLOCK } from "../runtimeHelpers";
import { isSlotOutlet } from "../utils";

const currentFilename = 'compiler-core/transforms/hoistStatic.ts'

export function hoistStatic(root, context) {
  console.log(print(currentFilename, 'hoistStatic->walk', `walk递归设置ast的hoisted,dynamicProps,props,patchFlag=-1`))
  walk(
    root,
    context,
    // 根节点是不能被静态提升的
    isSingleElementRoot(root, root.children[0])
  )
}

export function isSingleElementRoot(root, child) {
  const { children } = root
  return (
    children.length === 1 &&
    child.type === NodeTypes.ELEMENT &&
    !isSlotOutlet(child)
  )
}

/**
 * 在 codegenNode 
 * 存在纯静态标签 添加 hoisted 对象，并将静态 patchFlag 标记为 -1
 * 存在指令 设置 dynamicProps 对象，如：@click="click" 转为 onclick
 * 存在属性静态 在 props内添加 hoisted 对象
 * 
 * @param node 节点
 * @param context 转换器的上下文
 * @param doNotHoistNode 该节点是否可以被提升
 */
function walk(
  node: any,
  context: any,
  doNotHoistNode: boolean = false
) {
  // 取出子节点
  const { children } = node

  const originalCount = children.length
  let hoistedCount = 0

  // 将整个children 进行for循环每个节点，
  // 通过递归循环 element props 
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // 只有简单的元素以及文本是可以被合法提升的
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT
    ) {
      // 如果不允许被提升，则赋值 constantType NOT_CONSTANT 不可被提升的标记
      // 否则调用 getConstantType 获取子节点的静态类型
      const constantType = doNotHoistNode ? ConstantTypes.NOT_CONSTANT : getConstantType(child, context)
      
      // 如果获取到的 constantType 枚举值大于 NOT_CONSTANT
      if (constantType > ConstantTypes.NOT_CONSTANT) {
        // 根据 constantType 枚举值判断是否可以被字符序列化
        if (constantType >= ConstantTypes.CAN_HOIST) {
          // 则将子节点的 codegenNode 属性的 patchFlag 标记为 HOISTED 可提升
          // 静态标记 -1
          ; (child.codegenNode as VNodeCall).patchFlag = PatchFlags.HOISTED + (__DEV__ ? ` /* HOISTED */` : ``)
          child.codegenNode = context.hoist(child.codegenNode!)
          hoistedCount++
          continue
        }
      } else {
        // 节点可能包含动态的子节点，但是它的 props 属性也可能能被合法提升
        // codegenNode 将 props 添加到 codegenNode.props
        const codegenNode = child.codegenNode!
        if (codegenNode.type === NodeTypes.VNODE_CALL) {
          // 获取 patchFlag
          const flag = getPatchFlag(codegenNode)
          // 如果不存在 flag，或者 flag 是文本类型
          // 并且该节点 props 的 constantType 值判断出可以被提升
          if (
            (
              !flag ||
              flag === PatchFlags.NEED_PATCH ||
              flag === PatchFlags.TEXT
            ) &&
            getGeneratedPropsConstantType(child, context) >= ConstantTypes.CAN_HOIST
          ) {
            // 获取节点的 props，并在转换器上下文中执行提升操作
            const props = getNodeProps(child)
            if (props) {
              codegenNode.props = context.hoist(props)
            }
          }
          
          // 指令 塞到 dynamicProps， @click  
          if (codegenNode.dynamicProps) {
            
            codegenNode.dynamicProps = context.hoist(codegenNode.dynamicProps)
          }
        }
      }
    }
    
    // 循环起来
    if (child.type === NodeTypes.ELEMENT) {
      // 如果子节点的 tagType 是组件，则继续遍历子节点
      // 以便判断插槽中的情况
      const isComponent = child.tagType === ElementTypes.COMPONENT
      if (isComponent) {
        context.scopes.vSlot++
      }
      walk(child, context)
      if (isComponent) {
        context.scopes.vSlot--
      }
    } else if (child.type === NodeTypes.FOR) {
      // 查看 v-for 类型的节点是否能够被提升
      // 但是如果 v-for 的节点中是只有一个子节点，则不能被提升
      walk(child, context, child.children.length === 1)
    } else if (child.type === NodeTypes.IF) {
      // 如果子节点是 v-if 类型，判断它所有的分支情况
      for (let i = 0; i < child.branches.length; i++) {
        // 如果只有一个分支条件，则不进行提升
        walk(
          child.branches[i],
          context,
          child.branches[i].children.length === 1
        )
      }
    }
  }

  if (hoistedCount && context.transformHoist) {
    context.transformHoist(children, context, node)
  }

  if (
    hoistedCount &&
    hoistedCount === originalCount &&
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    node.codegenNode &&
    node.codegenNode.type === NodeTypes.VNODE_CALL &&
    isArray(node.codegenNode.children)
  ) {
    node.codegenNode.children = context.hoist(
      createArrayExpression(node.codegenNode.children)
    )
  }
}

// 区分各个节点类型来返回静态类型的,判断节点是否可以静态提升。
// 返回一共有4种类型，为0(NOT_CONSTANT)、1(CAN_SKIP_PATCH)、2(CAN_HOIST)、3(CAN_STRINGIFY)
export function getConstantType(node: any, context: any, walk?: any) {
  const { constantCache } = context
  switch (node.type) {
    case NodeTypes.ELEMENT:
      if (node.tagType !== ElementTypes.ELEMENT) {
        return ConstantTypes.NOT_CONSTANT
      }
      const cached = constantCache.get(node)
      if (cached !== undefined) {
        return cached
      }
      const codegenNode = node.codegenNode!
      if (codegenNode.type !== NodeTypes.VNODE_CALL) {
        return ConstantTypes.NOT_CONSTANT
      }
      if (
        codegenNode.isBlock &&
        node.tag !== 'svg' &&
        node.tag !== 'foreignObject'
      ) {
        return ConstantTypes.NOT_CONSTANT
      }
      const flag = getPatchFlag(codegenNode)
      if (!flag) {
        let returnType = ConstantTypes.CAN_STRINGIFY

        // Element itself has no patch flag. However we still need to check:

        // 1. Even for a node with no patch flag, it is possible for it to contain
        // non-hoistable expressions that refers to scope variables, e.g. compiler
        // injected keys or cached event handlers. Therefore we need to always
        // check the codegenNode's props to be sure.
        const generatedPropsType = getGeneratedPropsConstantType(node, context)
        if (generatedPropsType === ConstantTypes.NOT_CONSTANT) {
          constantCache.set(node, ConstantTypes.NOT_CONSTANT)
          return ConstantTypes.NOT_CONSTANT
        }
        if (generatedPropsType < returnType) {
          returnType = generatedPropsType
        }

        // 2. its children.
        for (let i = 0; i < node.children.length; i++) {
          const childType = getConstantType(node.children[i], context)
          if (childType === ConstantTypes.NOT_CONSTANT) {
            constantCache.set(node, ConstantTypes.NOT_CONSTANT)
            return ConstantTypes.NOT_CONSTANT
          }
          if (childType < returnType) {
            returnType = childType
          }
        }

        // 3. if the type is not already CAN_SKIP_PATCH which is the lowest non-0
        // type, check if any of the props can cause the type to be lowered
        // we can skip can_patch because it's guaranteed by the absence of a
        // patchFlag.
        if (returnType > ConstantTypes.CAN_SKIP_PATCH) {
          for (let i = 0; i < node.props.length; i++) {
            const p = node.props[i]
            if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind' && p.exp) {
              const expType = getConstantType(p.exp, context)
              if (expType === ConstantTypes.NOT_CONSTANT) {
                constantCache.set(node, ConstantTypes.NOT_CONSTANT)
                return ConstantTypes.NOT_CONSTANT
              }
              if (expType < returnType) {
                returnType = expType
              }
            }
          }
        }

        // only svg/foreignObject could be block here, however if they are
        // static then they don't need to be blocks since there will be no
        // nested updates.
        if (codegenNode.isBlock) {
          // except set custom directives.
          for (let i = 0; i < node.props.length; i++) {
            const p = node.props[i]
            if (p.type === NodeTypes.DIRECTIVE) {
              constantCache.set(node, ConstantTypes.NOT_CONSTANT)
              return ConstantTypes.NOT_CONSTANT
            }
          }

          context.removeHelper(OPEN_BLOCK)
          context.removeHelper(
            getVNodeBlockHelper(context.inSSR, codegenNode.isComponent)
          )
          codegenNode.isBlock = false
          context.helper(getVNodeHelper(context.inSSR, codegenNode.isComponent))
        }

        constantCache.set(node, returnType)
        return returnType
      } else {
        constantCache.set(node, ConstantTypes.NOT_CONSTANT)
        return ConstantTypes.NOT_CONSTANT
      }
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
      return ConstantTypes.CAN_STRINGIFY
    case NodeTypes.IF:
    case NodeTypes.FOR:
    case NodeTypes.IF_BRANCH:
      return ConstantTypes.NOT_CONSTANT
    case NodeTypes.INTERPOLATION:
    case NodeTypes.TEXT_CALL:
      return getConstantType(node.content, context)
    case NodeTypes.SIMPLE_EXPRESSION:
      return node.constType
    case NodeTypes.COMPOUND_EXPRESSION:
      let returnType = ConstantTypes.CAN_STRINGIFY
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (isString(child) || isSymbol(child)) {
          continue
        }
        const childType = getConstantType(child, context)
        if (childType === ConstantTypes.NOT_CONSTANT) {
          return ConstantTypes.NOT_CONSTANT
        } else if (childType < returnType) {
          returnType = childType
        }
      }
      return returnType
    default:
      // if (__DEV__) {
      //   const exhaustiveCheck: never = node
      //   exhaustiveCheck
      // }
      return ConstantTypes.NOT_CONSTANT
  }
}

const allowHoistedHelperSet = new Set([
  NORMALIZE_CLASS,
  NORMALIZE_STYLE,
  NORMALIZE_STYLE,
  GUARD_REACTIVE_PROPS
])

function getConstantTypeOfHelperCall(
  value,
  context
): ConstantTypes {
  if (
    value.type === NodeTypes.JS_CALL_EXPRESSION &&
    !isString(value.callee) &&
    allowHoistedHelperSet.has(value.callee)
  ) {
    const arg = value.arguments[0] as any
    if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
      return getConstantType(arg, context)
    } else if (arg.type === NodeTypes.JS_CALL_EXPRESSION) {
      // in the case of nested helper call, e.g. `normalizeProps(guardReactiveProps(exp))`
      return getConstantTypeOfHelperCall(arg, context)
    }
  }
  return ConstantTypes.NOT_CONSTANT
}

function getGeneratedPropsConstantType(
  node: any,
  context: any
) {
  let returnType = ConstantTypes.CAN_STRINGIFY
  const props = getNodeProps(node)
  if (props && props.type === NodeTypes.JS_OBJECT_EXPRESSION) {
    const { properties } = props
    for (let i = 0; i < properties.length; i++) {
      const { key, value } = properties[i]
      const keyType = getConstantType(key, context)
      if (keyType === ConstantTypes.NOT_CONSTANT) {
        return keyType
      }
      if (keyType < returnType) {
        returnType = keyType
      }
      let valueType: ConstantTypes
      if (value.type === NodeTypes.SIMPLE_EXPRESSION) {
        valueType = getConstantType(value, context)
      } else if (value.type === NodeTypes.JS_CALL_EXPRESSION) {
        // some helper calls can be hoisted,
        // such as the `normalizeProps` generated by the compiler for pre-normalize class,
        // in this case we need to respect the ConstantType of the helper's arguments
        valueType = getConstantTypeOfHelperCall(value, context)
      } else {
        valueType = ConstantTypes.NOT_CONSTANT
      }
      if (valueType === ConstantTypes.NOT_CONSTANT) {
        return valueType
      }
      if (valueType < returnType) {
        returnType = valueType
      }
    }
  }
  return returnType
}

function getNodeProps(node) {
  const codegenNode = node.codegenNode!
  if (codegenNode.type === NodeTypes.VNODE_CALL) {
    return codegenNode.props
  }
}

function getPatchFlag(node): number | undefined {
  const flag = node.patchFlag
  return flag ? parseInt(flag, 10) : undefined
}
