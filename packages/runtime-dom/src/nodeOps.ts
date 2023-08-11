

/**
 * 为什么要重新封装
 * 
 * 1、封装后更清楚简短，方便调用
 * 2、vue的渲染工作跟 dom 操作完全解耦，适合多端操作只需要对应的nodeOps
 *  
 */
export const svgNS = 'http://www.w3.org/2000/svg'

const doc = (typeof document !== 'undefined' ? document : null) as Document

const templateContainer = doc && /*#__PURE__*/ doc.createElement('template')

export const nodeOps = {

    insert: (child, parent, anchor) => {
        parent.insertBefore(child, anchor || null)

    },
    remove: (child) => {
        console.error(`remove`, child);
    },
    createElement: (tag, isSVG, is, props) => {
        const el = isSVG
          ? doc.createElementNS(svgNS, tag)
          : doc.createElement(tag, is ? { is } : undefined)
    
        if (tag === 'select' && props && props.multiple != null) {
          ;(el as HTMLSelectElement).setAttribute('multiple', props.multiple)
        }
    
        return el
    },
    // 创建 text 节点
    createText: text => doc.createTextNode(text),
    // commont 注释
    createComment: text => doc.createComment(text),

    setText: (node, text) => {
        node.nodeValue = text
    },
    // 
    setElementText: (el, text) => {
        el.textContent = text
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
    // 每个节点 设置 id compiler 时的id
    setScopeId(el, id) {
        el.setAttribute(id, '')
    },
    // 不安全，因为innerHTML
    // 此处的静态内容只能来自己编译的模版
    // 只要用户只使用受信任的模版才是安全的
    insertStaticContent(content, parent, anchor, isSVG, start, end) {
        console.error(`insertStaticContent`, content, parent, anchor, isSVG, start, end);
    }
}