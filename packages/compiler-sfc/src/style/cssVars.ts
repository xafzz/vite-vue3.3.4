import { print } from "@vue/shared";

const currentFilename = 'compiler-sfc/parse.ts'

//文档：https://cn.vuejs.org/api/sfc-css-features.html#v-bind-in-css

const vBindRE = /v-bind\s*\(/g

/** 以这段为例子
<style scoped>
div{
         //到这的位置是15，为什么不是14？ 因为解析的时候 'div{'前面还有个‘\n’位置
         //<style scoped>div{ 这个时候到这的距离就是14了
  width: v-bind('theme.width');
}
p {
  color: v-bind('theme.color');
}
</style>
 */
export function parseCssVars(sfc) {
    const vars = []

    sfc.styles.forEach(style => {
        let match
        // 把 /** */ 注释搞掉
        const content = style.content.replace(/\/\*([\s\S]*?)\*\//g, '')
        while ((match = vBindRE.exec(content))) {
            const start = match.index + match[0].length  //match[0].length ：`v-bind(`.length
            // lexBinging 一个很有意思的 函数
            const end = lexBinding(content, start)
            if (end !== null) {
                // 首先去除空格，如果v-bind('') 那就去掉，如果是v-bind("")去掉 ，只留下中间的内容
                const variable = normalizeExpression(content.slice(start, end))
                if (!vars.includes(variable) ) { 
                    vars.push(variable)
                } 
            }
        }
    });
    console.log(print(currentFilename, 'parseCssVars',`先把'/* */'注释去掉，解析css变量：'v-bind'`), vars);
    return vars
}

const enum LexerState {
    inParens,
    inSingleQuoteString,
    inDoubleQuoteString
}

// 查找下一个')'出现的位置
function lexBinding(content, start) {
    let state: LexerState = LexerState.inParens
    let parenDepth = 0

    // 拿到挨个字符
    for (let i = start; i < content.length; i++) {
        const char = content.charAt(i)
        switch (state) {
            case LexerState.inParens:
                if (char === `'`) {
                    state = LexerState.inSingleQuoteString
                } else if (char === `"`) {
                    state = LexerState.inDoubleQuoteString
                } else if (char === `(`) {
                    parenDepth++
                } else if (char === `)`) {
                    if (parenDepth > 0) {
                        parenDepth--
                    } else {
                        console.log(print(currentFilename, 'lexBinding', `查找下一个')'出现的位置：${i}`));
                        return i
                    }
                }
                break
            case LexerState.inSingleQuoteString:
                if (char === `'`) {
                    state = LexerState.inParens
                }
                break
            case LexerState.inDoubleQuoteString:
                if (char === `"`) {
                    state = LexerState.inParens
                }
                break
        }
    }
    return null
}

// 首先去除空格，如果v-bind('') 那就去掉，如果是v-bind("")去掉 ，只留下中间的内容
function normalizeExpression(exp) {
    exp = exp.trim()
    if (
        (exp[0] === `'` && exp[exp.length - 1] === `'`) ||
        (exp[0] === `"` && exp[exp.length - 1] === `"`)
    ) {
        return exp.slice(1, -1)
    }
    return exp
}