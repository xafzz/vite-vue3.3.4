import { isString, print } from "@vue/shared"
import { CREATE_BLOCK, CREATE_ELEMENT_BLOCK, CREATE_ELEMENT_VNODE, CREATE_VNODE, OPEN_BLOCK, WITH_DIRECTIVES } from "./runtimeHelpers"



const currentFilename = 'compiler-core/ast.ts'

export const enum Namespaces {
  HTML
}

/**
 * @param NOT_CONSTANT 一定要处理，不能跳过，也不能静态提升，更不能字符串化
 * @param CAN_SKIP_PATCH 打补丁的时候可以绕过
 * @param CAN_HOIST 可以静态提升
 * @param CAN_STRINGIFY 可以字符串化
 */
export const enum ConstantTypes {
  NOT_CONSTANT = 0, // 一定要处理，不能跳过，也不能静态提升，更不能字符串化
  CAN_SKIP_PATCH, // 打补丁的时候可以绕过
  CAN_HOIST,  // 可以静态提升
  CAN_STRINGIFY // 可以字符串化
}

export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  SIMPLE_EXPRESSION,
  INTERPOLATION,
  ATTRIBUTE,
  DIRECTIVE,
  // containers
  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,
  TEXT_CALL,
  // codegen
  VNODE_CALL,
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION,
  JS_FUNCTION_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION,
  JS_CACHE_EXPRESSION,

  // ssr codegen
  JS_BLOCK_STATEMENT,
  JS_TEMPLATE_LITERAL,
  JS_IF_STATEMENT,
  JS_ASSIGNMENT_EXPRESSION,
  JS_SEQUENCE_EXPRESSION,
  JS_RETURN_STATEMENT
}


export const enum ElementTypes {
  ELEMENT, //节点
  COMPONENT, //注释
  SLOT, // 插槽
  TEMPLATE // tempalte
}

export interface Node {
  type: NodeTypes
  loc: SourceLocation
}

// The node's range. The `start` is inclusive and `end` is exclusive.
// [start, end)
export interface SourceLocation {
  start: Position
  end: Position
  source: string
}

export interface Position {
  offset: number // from start of file
  line: number
  column: number
}

// compiler-core/ast.ts 中 createRoot 传参数 传过来了
export const locStub = {
  // source:'', 注释掉
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 }
}


export function createRoot(
  children,
  loc = locStub
) {

  console.log(print(currentFilename, 'createRoot()'), loc)

  return {
    type: NodeTypes.ROOT,
    children,
    helpers: new Set(),
    components: [],
    directives: [],
    hoists: [],
    imports: [],
    cached: 0,
    temps: 0,
    codegenNode: undefined,
    loc
  }
}

export function createConditionalExpression(
  test: any,
  consequent: any,
  alternate: any,
  newline = true
): any {
  return {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent,
    alternate,
    newline,
    loc: locStub
  }
}

export function createCacheExpression(
  index: number,
  value: any,
  isVNode: boolean = false
): any {
  return {
    type: NodeTypes.JS_CACHE_EXPRESSION,
    index,
    value,
    isVNode,
    loc: locStub
  }
}

export function createBlockStatement(
  body: any
): any {
  return {
    type: NodeTypes.JS_BLOCK_STATEMENT,
    body,
    loc: locStub
  }
}

export function createTemplateLiteral(
  elements: any
): any {
  return {
    type: NodeTypes.JS_TEMPLATE_LITERAL,
    elements,
    loc: locStub
  }
}

export function createIfStatement(
  test: any,
  consequent: any,
  alternate?: any
): any {
  return {
    type: NodeTypes.JS_IF_STATEMENT,
    test,
    consequent,
    alternate,
    loc: locStub
  }
}

export function createSimpleExpression(
  content: any,
  isStatic = false,
  loc = locStub,
  constType: ConstantTypes = ConstantTypes.NOT_CONSTANT
): any {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    content,
    isStatic,
    constType: isStatic ? ConstantTypes.CAN_STRINGIFY : constType
  }
}

export function createCompoundExpression(
  children: any,
  loc = locStub
) {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    loc,
    children
  }
}


export function createCallExpression(
  callee,
  args: any,
  loc = locStub
) {
  return {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee,
    arguments: args
  } as any
}



export function getVNodeHelper(ssr: boolean, isComponent: boolean) {
  return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE
}

export function getVNodeBlockHelper(ssr: boolean, isComponent: boolean) {
  return ssr || isComponent ? CREATE_BLOCK : CREATE_ELEMENT_BLOCK
}

export function convertToBlock(
  node: any,
  { helper, removeHelper, inSSR }: any
) {
  if (!node.isBlock) {
    node.isBlock = true
    removeHelper(getVNodeHelper(inSSR, node.isComponent))
    helper(OPEN_BLOCK)
    helper(getVNodeBlockHelper(inSSR, node.isComponent))
  }
}


export interface VNodeCall extends Node {
  type: NodeTypes.VNODE_CALL
  tag: string | symbol | any //CallExpression
  props: any | undefined // PropsExpression
  children:
  | any
  // | TemplateChildNode[] // multiple children
  // | TemplateTextChildNode // single text child
  // | SlotsExpression // component slots
  // | ForRenderListExpression // v-for fragment call
  // | SimpleExpressionNode // hoisted
  | undefined
  patchFlag: string | undefined
  dynamicProps: string | any | undefined //SimpleExpressionNode
  directives: any | undefined // DirectiveArguments
  isBlock: boolean
  disableTracking: boolean
  isComponent: boolean
}


export function createArrayExpression(
  elements: any,
  loc = locStub
): any {
  return {
    type: NodeTypes.JS_ARRAY_EXPRESSION,
    loc,
    elements
  }
}

export function createObjectExpression(
  properties: any,
  loc = locStub
): any {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    loc,
    properties
  }
}


export function createObjectProperty(
  key: any | string,
  value: any
): any {
  return {
    type: NodeTypes.JS_PROPERTY,
    loc: locStub,
    key: isString(key) ? createSimpleExpression(key, true) : key,
    value
  }
}

export function createInterpolation(
  content: any | string,
  loc: any
): any {
  return {
    type: NodeTypes.INTERPOLATION,
    loc,
    content: isString(content)
      ? createSimpleExpression(content, false, loc)
      : content
  }
}


export function createFunctionExpression(
  params: any,
  returns = undefined,
  newline: boolean = false,
  isSlot: boolean = false,
  loc = locStub
): any {
  return {
    type: NodeTypes.JS_FUNCTION_EXPRESSION,
    params,
    returns,
    newline,
    isSlot,
    loc
  }
}



export function createVNodeCall(
  context: any | null,
  tag: VNodeCall['tag'],
  props?: VNodeCall['props'],
  children?: VNodeCall['children'],
  patchFlag?: VNodeCall['patchFlag'],
  dynamicProps?: VNodeCall['dynamicProps'],
  directives?: VNodeCall['directives'],
  isBlock: VNodeCall['isBlock'] = false,
  disableTracking: VNodeCall['disableTracking'] = false,
  isComponent: VNodeCall['isComponent'] = false,
  loc: any = locStub
): VNodeCall {
  if (context) {
    if (isBlock) {
      context.helper(OPEN_BLOCK)
      context.helper(getVNodeBlockHelper(context.inSSR, isComponent))
    } else {
      context.helper(getVNodeHelper(context.inSSR, isComponent))
    }
    if (directives) {
      context.helper(WITH_DIRECTIVES)
    }
  }

  return {
    type: NodeTypes.VNODE_CALL,
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isBlock,
    disableTracking,
    isComponent,
    loc
  }
}