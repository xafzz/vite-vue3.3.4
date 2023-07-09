import { extend, print } from "@vue/shared"


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
export function advancePositionWithMutation(
    pos,
    source,
    numberOfCharacters
) {

    console.log(print(currentFilename, 'advancePostionWithMutation()'), pos, source, numberOfCharacters)

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

    return pos
}
