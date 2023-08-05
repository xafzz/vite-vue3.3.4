import { ElementTypes, NodeTypes, createSimpleExpression } from "../ast";
import { ErrorCodes, createCompilerError } from "../errors";
import { createStructuralDirectiveTransform } from "../transform"
import { findDir, findProp } from "../utils";
import { validateBrowserExpression } from "../validateExpression";
import { processExpression } from "./transformExpression";


export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {

      console.warn(``, 4444445);
      return () => {

      }
    })
  }
)

export function processIf(
  node,
  dir,
  context,
  processCodegen?: (
    node,
    branch,
    isRoot: boolean
  ) => (() => void) | undefined
) {
  // 如果指令不是else，并且不存在表达式或者表达式内容为空时需要报错，重新设置表达式内容为true
  if (
    dir.name !== 'else' &&
    (!dir.exp || !(dir.exp as any).content.trim())
  ) {
    const loc = dir.exp ? dir.exp.loc : node.loc
    context.onError(
      createCompilerError(ErrorCodes.X_V_IF_NO_EXPRESSION, dir.loc)
    )
    dir.exp = createSimpleExpression(`true`, false, loc)
  }

  if (!__BROWSER__ && context.prefixIdentifiers && dir.exp) {
    //dir.exp只能是简单表达式，因为应用了v-if变换
    //在表达式转换之前。
    dir.exp = processExpression(dir.exp as any, context)
  }

  // 检查表达式是否符合规范有无关键字等
  if (dir.exp) {
    validateBrowserExpression(dir.exp as any, context)
  }

  // 如果指令是if
  if (dir.name === 'if') {
    //  构建if的表达式
    const branch = createIfBranch(node, dir)
    // 这里重新构建if节点，将刚才创建的if分支的表达式放入到分支数组中去，
    // 其他的else-if和else分支也会在之后添加到branches中去
    const ifNode = {
      type: NodeTypes.IF, //9
      loc: node.loc,
      branches: [branch]
    }
    // 对节点进行替换
    // 需要把上下文if节点的父节点素的子节点替换成新的if节点，同时也要替换掉当前的if节点
    // context.parent.children[context.childIndex] = context.currentNode = node;
    context.replaceNode(ifNode)
    if (processCodegen) { 
      return processCodegen(ifNode, branch, true)
    }
  } else {
    console.error(`processIf dir.name ！== 'if'`, node, dir, context);
  }
  console.error(`processIf`, node, dir, context);
}

//  构建if的表达式
function createIfBranch(node, dir) {
  const isTemplateIf = node.tagType === ElementTypes.TEMPLATE
  return {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: dir.name === 'else' ? undefined : dir.exp,
    children: isTemplateIf && !findDir(node, 'for') ? node.children : [node],
    userKey: findProp(node, `key`),
    isTemplateIf
  }
}