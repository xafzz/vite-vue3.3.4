import { ConstantTypes, NodeTypes, createSimpleExpression } from "@vue/compiler-core";
import { parseStringStyle, print } from "@vue/shared";

const currentFilename = 'compiler-dom/transformStyle.ts'

//将静态样式属性的内联CSS字符串解析到对象中。
//这是一个NodeTransform，因为它适用于静态的“style”属性，并且
//将其转换为动态等价物：
//style=“color:red”->：style=“｛”color“：”red“｝”
//然后，它由“transformElement”处理，并包含在生成的 props
// 行内样式 转换样式
export const transformStyle = node => {
    // 如果是元素节点
    if (node.type === NodeTypes.ELEMENT) {
        // 遍历元素节点上的属性值 
        node.props.forEach((p, i) => {
            // 如果存在样式属性，并且有值
            if (p.type === NodeTypes.ATTRIBUTE && p.name === 'style' && p.value) { 
                // 用表达式替换p
                node.props[i] = {
                    type: NodeTypes.DIRECTIVE,
                    name: `bind`,
                    arg: createSimpleExpression(`style`, true, p.loc),
                    exp: parseInlineCSS(p.value.content, p.loc),
                    modifiers: [],
                    loc: p.loc
                  }
            }
        })
        if ( node.props.length ){ 
            console.log(print(currentFilename, 'transformStyle', `将有属性元素${node.tag}:上各个属性push到'props':`), node.props)
        }
    }
}


const parseInlineCSS = (
    cssText: string,
    loc
  ): any => {
    const normalized = parseStringStyle(cssText)
    return createSimpleExpression(
      JSON.stringify(normalized),
      false,
      loc,
      ConstantTypes.CAN_STRINGIFY
    )
  }
  