

/**
 * 为什么要重新封装
 * 
 * 1、封装后更清楚简短，方便调用
 * 2、vue的渲染工作跟 dom 操作完全解耦，适合多端操作只需要对应的nodeOps
 *  
 */

export const nodeOps = {

    insert: (child, parent, anchor) => {
        console.error(`insert`, child, parent, anchor);

    },
    remove: (child) => {
        console.error(`remove`, child);
    },
    createElement: (tag, isSVG, is, props) => {
        console.error(`createElement`, tag, isSVG, is, props);
    },
    createText: text => {
        console.error(`createText`, text);
    },
    createComment: text => {
        console.error(`createComment`, text);
    },
    setText: (node, text) => {
        console.error(`setText`, node, text);
    },
    setElementText: (el, text) => {
        console.error(`setElementText`, el, text);
    },
    parentNode: node => {
        console.error(`parentNode`, node);
    },
    nextSibling: node => {
        console.error(`nextSibling`, node);
    },
    querySelector: selector => {
        console.error(`querySelector`, selector);
    },
    setScopeId(el, id) {
        console.error(`setScopeId`, el, id);
    },
    // 不安全，因为innerHTML
    // 此处的静态内容只能来自己编译的模版
    // 只要用户只使用受信任的模版才是安全的
    insertStaticContent(content, parent, anchor, isSVG, start, end) {
        console.error(`insertStaticContent`, content, parent, anchor, isSVG, start, end);
    }
}