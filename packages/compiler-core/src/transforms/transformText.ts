import { PatchFlagNames, PatchFlags } from "@vue/shared";
import { ConstantTypes, ElementTypes, NodeTypes, createCallExpression, createCompoundExpression } from "../ast";
import { CREATE_TEXT } from "../runtimeHelpers";
import { isText } from "../utils";
import { getConstantType } from "./hoistStatic";


// 转换文本
// 主要处理含有文本节点的父节点，需要对子文本节点进行组合
// 比如hello { { name } } 在AST中生成的节点是分开的2个节点
// 但JavaScript AST会将2个节点进行合并
export const transformText = (node:any, context) => {

  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    //对节点出口执行转换，以便所有表达式都已处理。
    return () => {
      // 获取ast该节点下的子节点
      const children = node.children
      let currentContainer = undefined
      let hasText = false

      // 遍历子节点
      for (let i = 0; i < children.length; i++) {
        /**
         * 例：<p :class="['class','ddd']">hello，{{name}}</p>
         * children:[
         *  {type: 2, content: 'hello，', loc: {…}},
         *  {
         *    content: {type: 4, isStatic: false, constType: 0, content: 'name', loc: {…}},
         *    loc: {start: {…}, end: {…}, source: '{{name}}'},
         *    type: 5
         *  }
         * ]
         */
        const child = children[i]
        // 判断node.type为5或者为2就是text类型，5是插值，2是文本
        if (isText(child)) {
          hasText = true;
          // 循环拼接
          for (let j = i + 1; j < children.length; j++) {
            // 先获取下一个子节点
            const next = children[j];
            // 如果下一个子节点是文本
            if (isText(next)) {
              // 第一次循环为undefined
              if (!currentContainer) {
                // 构建当前容器，重新组装该节点，将type改为复合表达式（8），将自身放入新节点的子节点中
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc
                )
              }
              // 将下一节点加入到容器的子节点中
              currentContainer.children.push(` + `, next);
              // 把下一个节点删除
              children.splice(j, 1);
              // 减一，在删除了开始节点后面的节点后，splice已改变了数组长度，这样需要j--才可以获取到对的下一个节点
              j--;
            } else {
              // 如果存在节点不是text就清空当前容器，并且退出
              currentContainer = undefined
              break
            }
          }
        }
      }

      // 如果内部不存在纯文本或插值，或者已经合并好了并且为根节点或html标签节点
      if (
        !hasText ||
        //如果这是一个带有单个文本子项的普通元素，请将其保留
        //因为运行时通过直接
        //设置元素的textContent。
        //对于组件根，它总是被规范化的。
        (children.length === 1 &&
          (node.type === NodeTypes.ROOT ||
            (node.type === NodeTypes.ELEMENT &&
              node.tagType === ElementTypes.ELEMENT &&
              // #3756
              //自定义指令可以潜在地任意添加DOM元素，
              //我们需要避免在运行时设置元素的textContent
              //以避免意外覆盖添加的DOM元素
              //由用户通过自定义指令执行。
              !node.props.find(
                p =>
                  p.type === NodeTypes.DIRECTIVE &&
                  !context.directiveTransforms[p.name]
              ) &&
              //在compat模式下，＜template＞标记没有特殊指令 
              //将呈现为片段，因此其子项必须
              //转换为vnode。
              !(__COMPAT__ && node.tag === 'template'))))
      ) {
        return
      }

      // 当前的children已经是合并和删减完的children了，里面包含文本和插值的合并，以及其他无法合并的节点
      for (let i = 0; i < children.length; i++) {
        // 获取第一个子节点
        const child = children[i]
        // 子节点是文字或插槽，或者是已经合并好的复合表达式
        // @ts-ignore
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs = []
          // 如果节点不是纯文本或者节点内容不为空格
          if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
            callArgs.push(child)
          }
          // 用标记标记动态文本，以便它在块中得到修补
          if (
            !context.ssr &&
            getConstantType(child, context) === ConstantTypes.NOT_CONSTANT
          ) {
            callArgs.push(
              PatchFlags.TEXT +
              (__DEV__ ? ` /* ${PatchFlagNames[PatchFlags.TEXT]} */` : ``)
            )
          }
          children[i] = {
            type: NodeTypes.TEXT_CALL,
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs
            )
          }
        }
      }
      console.error(444, `transformText`, children);
    }
  }
}
