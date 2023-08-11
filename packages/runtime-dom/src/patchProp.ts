
import { isFunction, isModelListener, isOn, isString } from '@vue/shared';
import { patchClass } from './modules/class'
import { patchEvent } from './modules/events';
import { patchStyle } from './modules/style';
import { patchAttr } from './modules/attrs';
import { patchDOMProp } from './modules/props'

// 节点 设置 props 就是 属性
// key  id class style 自定义属性 onclick
export const patchProp = (
    el,
    key,
    prevValue,
    nextValue,
    isSVG = false,
    prevChildren,
    parentComponent,
    parentSuspense,
    unmountChildren
) => {
    if (key === 'class') {
        patchClass(el, nextValue, isSVG)
    } else if (key === 'style') {
        patchStyle(el, prevValue, nextValue)
    } else if (isOn(key)) {
        // 忽略 v-model
        if (!isModelListener(key)) {
            // @ts-ignore
            patchEvent(el, key, prevValue, nextValue, parentComponent)
        }
    } else if (
        key[0] === '.'
            ? ((key = key.slice(1)), true)
            : key[0] === '^'
                ? ((key = key.slice(1)), false)
                : shouldSetAsProp(el, key, nextValue, isSVG)
    ) {
        // id
        patchDOMProp(
            el,
            key,
            nextValue,
            prevChildren,
            parentComponent,
            parentSuspense,
            unmountChildren
        )
    } else {
        // 自定义属性 也在这
        // <input v-model type=“checkbox”>的特殊情况
        // :true-value & :false-value
        if (key === 'true-value') {
            ; (el as any)._trueValue = nextValue
        } else if (key === 'false-value') {
            ; (el as any)._falseValue = nextValue
        }
        patchAttr(el, key, nextValue, isSVG, parentComponent)
    }
}

const nativeOnRE = /^on[a-z]/

function shouldSetAsProp(
    el: Element,
    key: string,
    value: unknown,
    isSVG: boolean
) {
    if (isSVG) {
        // most keys must be set as attribute on svg elements to work
        // ...except innerHTML & textContent
        if (key === 'innerHTML' || key === 'textContent') {
            return true
        }
        // or native onclick with function values
        if (key in el && nativeOnRE.test(key) && isFunction(value)) {
            return true
        }
        return false
    }

    // these are enumerated attrs, however their corresponding DOM properties
    // are actually booleans - this leads to setting it with a string "false"
    // value leading it to be coerced to `true`, so we need to always treat
    // them as attributes.
    // Note that `contentEditable` doesn't have this problem: its DOM
    // property is also enumerated string values.
    if (key === 'spellcheck' || key === 'draggable' || key === 'translate') {
        return false
    }

    // #1787, #2840 form property on form elements is readonly and must be set as
    // attribute.
    if (key === 'form') {
        return false
    }

    // #1526 <input list> must be set as attribute
    if (key === 'list' && el.tagName === 'INPUT') {
        return false
    }

    // #2766 <textarea type> must be set as attribute
    if (key === 'type' && el.tagName === 'TEXTAREA') {
        return false
    }

    // native onclick with string value, must be set as attribute
    if (nativeOnRE.test(key) && isString(value)) {
        return false
    }

    return key in el
}