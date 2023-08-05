import { NOOP, extend, hyphenate, isObject, isString, print } from "@vue/shared"
import { BASE_TRANSITION, KEEP_ALIVE, SUSPENSE, TELEPORT, WITH_MEMO } from "./runtimeHelpers"
import { ElementTypes, NodeTypes } from "./ast"
import { parseExpression } from '@babel/parser'

const currentFilename = 'compiler-core/utils.ts'

// 搞个断言？
export function assert(condition: boolean, msg?: string) {
  if (!condition) {
    throw new Error(msg || `意外的编译器条件`)
  }
}


export function advancePositionWithClone(
  pos,
  source: string,
  numberOfCharacters: number = source.length
) {
  return advancePositionWithMutation(
    extend({}, pos),
    source,
    numberOfCharacters
  )
}


//通过突变而不进行克隆（出于性能原因），因为
//在解析器中被调用很多
// 变更坐标
export function advancePositionWithMutation(
  pos,
  source,
  numberOfCharacters
) {

  let linesCount = 0
  let lastNewLinePos = -1

  // numberOfCharacters <template <script <style 长度
  for (let i = 0; i < numberOfCharacters; i++) {
    // 返回 换行符 '\n' 的 code
    // source 为 <div id  =  'xx id="ddd" class="hello" index-data="dd">hello world</div>
    // 解析出来 'xx id="ddd" class="hello" index-data="dd">hello world</div>\n' 
    // 直接匹配最后一个单引号(')前面的'\n', 
    if (source.charCodeAt(i) === 10) {
      linesCount++
      lastNewLinePos = i
    }
  }

  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos

  console.log(print(currentFilename, 'advancePostionWithMutation()', '变更坐标->'), pos)
  return pos
}

export const isBuiltInType = (tag: string, expected: string): boolean =>
  tag === expected || tag === hyphenate(expected)

export function isText(
  node: any
): node is any {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}

export function isVSlot(p) {
  return p.type === NodeTypes.DIRECTIVE && p.name === 'slot'
}

export function isTemplateNode(
  node: any
) {
  return (
    node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.TEMPLATE
  )
}

export function isSlotOutlet(
  node: any
) {
  return node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.SLOT
}

export function isCoreComponent(tag: string): symbol | void {
  if (isBuiltInType(tag, 'Teleport')) {
    return TELEPORT
  } else if (isBuiltInType(tag, 'Suspense')) {
    return SUSPENSE
  } else if (isBuiltInType(tag, 'KeepAlive')) {
    return KEEP_ALIVE
  } else if (isBuiltInType(tag, 'BaseTransition')) {
    return BASE_TRANSITION
  }
}

// 有没有props
export function findDir(
  node: any,
  name: string | RegExp,
  allowEmpty: boolean = false
): any | undefined {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (
      p.type === NodeTypes.DIRECTIVE &&
      (allowEmpty || p.exp) &&
      (isString(name) ? p.name === name : name.test(p.name))
    ) {
      return p
    }
  }
}

export function findProp(
  node: any,
  name: string,
  dynamicOnly: boolean = false,
  allowEmpty: boolean = false
): any | undefined {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (dynamicOnly) continue
      if (p.name === name && (p.value || allowEmpty)) {
        return p
      }
    } else if (
      p.name === 'bind' &&
      (p.exp || allowEmpty) &&
      isStaticArgOf(p.arg, name)
    ) {
      return p
    }
  }
}

export const isStaticExp = (p) =>
  p.type === NodeTypes.SIMPLE_EXPRESSION && p.isStatic

export function isStaticArgOf(
  arg: any,
  name: string
): boolean {
  return !!(arg && isStaticExp(arg) && arg.content === name)
}

export function getInnerRange(
  loc: any,
  offset: number,
  length: number
): any {
  __TEST__ && assert(offset <= loc.source.length)
  const source = loc.source.slice(offset, offset + length)
  const newLoc = {
    source,
    start: advancePositionWithClone(loc.start, loc.source, offset),
    end: loc.end
  }

  if (length != null) {
    __TEST__ && assert(offset + length <= loc.source.length)
    newLoc.end = advancePositionWithClone(
      loc.start,
      loc.source,
      offset + length
    )
  }

  return newLoc
}

const enum MemberExpLexState {
  inMemberExp,
  inBrackets,
  inParens,
  inString
}

const validFirstIdentCharRE = /[A-Za-z_$\xA0-\uFFFF]/
const validIdentCharRE = /[\.\?\w$\xA0-\uFFFF]/
const whitespaceRE = /\s+[.[]\s*|\s*[.[]\s+/g

/**
 * Simple lexer to check if an expression is a member expression. This is
 * lax and only checks validity at the root level (i.e. does not validate exps
 * inside square brackets), but it's ok since these are only used on template
 * expressions and false positives are invalid expressions in the first place.
 */
export const isMemberExpressionBrowser = (path: string): boolean => {
  // remove whitespaces around . or [ first
  path = path.trim().replace(whitespaceRE, s => s.trim())

  let state = MemberExpLexState.inMemberExp
  let stateStack: MemberExpLexState[] = []
  let currentOpenBracketCount = 0
  let currentOpenParensCount = 0
  let currentStringType: "'" | '"' | '`' | null = null

  for (let i = 0; i < path.length; i++) {
    const char = path.charAt(i)
    switch (state) {
      case MemberExpLexState.inMemberExp:
        if (char === '[') {
          stateStack.push(state)
          state = MemberExpLexState.inBrackets
          currentOpenBracketCount++
        } else if (char === '(') {
          stateStack.push(state)
          state = MemberExpLexState.inParens
          currentOpenParensCount++
        } else if (
          !(i === 0 ? validFirstIdentCharRE : validIdentCharRE).test(char)
        ) {
          return false
        }
        break
      case MemberExpLexState.inBrackets:
        if (char === `'` || char === `"` || char === '`') {
          stateStack.push(state)
          state = MemberExpLexState.inString
          currentStringType = char
        } else if (char === `[`) {
          currentOpenBracketCount++
        } else if (char === `]`) {
          if (!--currentOpenBracketCount) {
            state = stateStack.pop()!
          }
        }
        break
      case MemberExpLexState.inParens:
        if (char === `'` || char === `"` || char === '`') {
          stateStack.push(state)
          state = MemberExpLexState.inString
          currentStringType = char
        } else if (char === `(`) {
          currentOpenParensCount++
        } else if (char === `)`) {
          // if the exp ends as a call then it should not be considered valid
          if (i === path.length - 1) {
            return false
          }
          if (!--currentOpenParensCount) {
            state = stateStack.pop()!
          }
        }
        break
      case MemberExpLexState.inString:
        if (char === currentStringType) {
          state = stateStack.pop()!
          currentStringType = null
        }
        break
    }
  }
  return !currentOpenBracketCount && !currentOpenParensCount
}

export const isMemberExpressionNode = __BROWSER__
  ? (NOOP as any as (path: string, context: any) => boolean)
  : (path: string, context: any): boolean => {
    try {
      let ret: any = parseExpression(path, {
        plugins: context.expressionPlugins
      })
      if (ret.type === 'TSAsExpression' || ret.type === 'TSTypeAssertion') {
        ret = ret.expression
      }
      return (
        ret.type === 'MemberExpression' ||
        ret.type === 'OptionalMemberExpression' ||
        ret.type === 'Identifier'
      )
    } catch (e) {
      return false
    }
  }


export const isMemberExpression = __BROWSER__
  ? isMemberExpressionBrowser
  : isMemberExpressionNode

const nonIdentifierRE = /^\d|[^\$\w]/
export const isSimpleIdentifier = (name: string): boolean =>
  !nonIdentifierRE.test(name)

//检查节点是否包含引用当前上下文作用域ID的表达式
export function hasScopeRef(
  node: any | undefined,
  ids: any
): boolean {
  if (!node || Object.keys(ids).length === 0) {
    return false
  }
  switch (node.type) {
    case NodeTypes.ELEMENT:
      for (let i = 0; i < node.props.length; i++) {
        const p = node.props[i]
        if (
          p.type === NodeTypes.DIRECTIVE &&
          (hasScopeRef(p.arg, ids) || hasScopeRef(p.exp, ids))
        ) {
          return true
        }
      }
      return node.children.some(c => hasScopeRef(c, ids))
    case NodeTypes.FOR:
      if (hasScopeRef(node.source, ids)) {
        return true
      }
      return node.children.some(c => hasScopeRef(c, ids))
    case NodeTypes.IF:
      return node.branches.some(b => hasScopeRef(b, ids))
    case NodeTypes.IF_BRANCH:
      if (hasScopeRef(node.condition, ids)) {
        return true
      }
      return node.children.some(c => hasScopeRef(c, ids))
    case NodeTypes.SIMPLE_EXPRESSION:
      return (
        !node.isStatic &&
        isSimpleIdentifier(node.content) &&
        !!ids[node.content]
      )
    case NodeTypes.COMPOUND_EXPRESSION:
      return node.children.some(c => isObject(c) && hasScopeRef(c, ids))
    case NodeTypes.INTERPOLATION:
    case NodeTypes.TEXT_CALL:
      return hasScopeRef(node.content, ids)
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
      return false
    default:
      // if (__DEV__) {
      //   const exhaustiveCheck: never = node
      //   exhaustiveCheck
      // }
      return false
  }
}

export function getMemoedVNodeCall(node: any | any) {
  if (node.type === NodeTypes.JS_CALL_EXPRESSION && node.callee === WITH_MEMO) {
    return node.arguments[1].returns as any
  } else {
    return node
  }
}


export function toValidAssetId(
  name: string,
  type: 'component' | 'directive' | 'filter'
): string {
  // see issue#4422, we need adding identifier on validAssetId if variable `name` has specific character
  return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
    return searchValue === '-' ? '_' : name.charCodeAt(replaceValue).toString()
  })}`
}