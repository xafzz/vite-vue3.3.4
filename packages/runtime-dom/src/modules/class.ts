


export function patchClass(el, value, isSvg) {

    //理论上，直接设置className应该比setAttribute快
    //如果这是转换过程中的元素，请执行临时转换
    const transitionClasses = el._vtc
    if (transitionClasses) {
        console.error(`el._vtc`,);
    }

    if (value == null) {
        el.removeAttribute('class')
    } else if (isSvg) {
        el.setAttribute('class', value)
    } else {
        el.className = value
    }
}