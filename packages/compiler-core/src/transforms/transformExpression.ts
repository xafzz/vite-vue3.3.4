import { NodeTypes } from "../ast";

// 转换表达式
// 对表达式进行检查，确保表达式里不包含关键字，无论是插值还是指令中是否包含非法的关键字，
// 比如{{ let a }} {{ for }}
export const transformExpression = (node, context) => {
  // 如果是插值的话
  if (node.type === NodeTypes.INTERPOLATION) {
    // 验证表达式是否没问题，是否含有关键字等
    node.content = processExpression(
      node.content as any,
      context
    )
    
  }
  // 如果是元素节点
  else if (node.type === NodeTypes.ELEMENT) {
    // 处理元素上的属性
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      // 不处理v-on和v-for，因为它们是特殊处理的
      if (dir.type === NodeTypes.DIRECTIVE && dir.name !== 'for') {
        /**
         * 例：<p :class="['class','ddd']"> 生成ast
         * {
         *  arg: {type: 4, content: 'class', isStatic: true, constType: 3, loc: {…}}
         *  exp: {type: 4, content: "['class','ddd']", isStatic: false, constType: 0, loc: {…}}
         *  loc: {start: {…}, end: {…}, source: `:class="['class','ddd']"`}
         *  modifiers: []
         *  name: "bind"
         *  type: 7
         * }
         */
        const arg = dir.arg
        const exp = dir.exp
        //如果是v-on:arg，需要特殊处理
        if (
          exp &&
          exp.type === NodeTypes.SIMPLE_EXPRESSION &&
          !(dir.name === 'on' && arg)
        ) {
          dir.exp = processExpression(
            exp,
            context,
            // slot args must be processed as function params
            dir.name === 'slot'
          )
        }
        if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION && !arg.isStatic) {
          dir.arg = processExpression(arg, context)
        }
      }
    }
  }
}

// 重要提示：由于此函数只使用Node.js依赖项，因此它应该
// 总是与前导词一起使用__BROWSER__检查，以便
// tree-shaken 从浏览器构建中动摇。
export function processExpression(
  node,
  context,
  // some expressions like v-slot props & v-for aliases should be parsed as
  // function params
  asParams = false,
  // v-on handler values may contain multiple statements
  asRawStatements = false,
  localVars: Record<string, number> = Object.create(context.identifiers)
) {

  if (!context.prefixIdentifiers || !node.content.trim()) {
    return node
  }

  console.error(`processExpression`,);

}