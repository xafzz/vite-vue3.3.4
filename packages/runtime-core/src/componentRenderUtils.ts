import { PatchFlags, ShapeFlags, print } from "@vue/shared";
import { setCurrentRenderingInstance } from "./componentRenderContext";
import { Comment, blockStack, createVNode, isVNode, normalizeVNode } from "./vnode";
import { ErrorCodes, handleError } from "./errorHandling";
import { DeprecationTypes, isCompatEnabled } from "./compat/compatConfig";







const filename = 'runtime-core/renderer.ts'


/**
 * dev only flag to track whether $attrs was used during render.
 * If $attrs was used during render then the warning for failed attrs
 * fallthrough can be suppressed.
 */
let accessedAttrs: boolean = false

export function markAttrsAccessed() {
  accessedAttrs = true
}

type SetRootFn = ((root: any) => void) | undefined

// 对template进行渲染
// 核心工作是通过一个代理对象调用了组件的render函数
// 为什么要代理对象？
// 其中一个重要原因是对ref值的访问不需要再使用.value的形式
// 另一方面可以保护子组件的内容不被父组件随意访问
export function renderComponentRoot(instance: any): any {

  const {
    type: Component, // 具名匹配 传递給Component
    vnode, // instance 也传递了vnode 可以说是一个component的核心了吧
    proxy,
    withProxy,
    props,
    propsOptions: [propsOptions],
    slots,
    attrs, // props 
    emit,
    /**
     * render:function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
     *    return (_openBlock(), _createElementBlock(_Fragment, null, [_createElementVNode("div", _hoisted_1, [
     *        code
     *  ]})
     */
    render, // 这里render 是 .vue 编译后的render函数
    renderCache,
    data,
    setupState,
    ctx,
    inheritAttrs
  } = instance

  let result
  let fallthroughAttrs
  // 当前正在render的组件 null
  const prev = setCurrentRenderingInstance(instance)
  if (__DEV__) {
    accessedAttrs = false
  }

  try {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // withProxy 是一个带有不同 `has` 陷阱的代理，仅适用于
      // 使用 `with` 块运行时编译的渲染函数。
      const proxyToUse = withProxy || proxy

      // 触发render方法，这里面用到了响应式中数据的话，则会对 effect 响应式处理
      // 指定this后执行render得到数据被取值后的vnode树 在这个过程中 由于之前设置的proxy代理 劫持了get和set 导致当前effect会被收集到counter的effect集合中
      // 最后渲染得到的是一个简单的字符串 然后normalizeVNode把字符串变成一个 textnode类型的vnode 供path方法使用

      result = normalizeVNode(
        // 执行 生成的 render 函数
        // return (_openBlock(), _createElementBlock(_Fragment, null, [_createElementVNode("div", _hoisted_1, []
        // 先去执行 _openBlock

        render!.call(
          proxyToUse,
          proxyToUse!,
          renderCache,
          props,
          setupState,
          data,
          ctx
        )
      )
      fallthroughAttrs = attrs
    } else {
      // 函数组件
      console.error(``, 2222);
    }
  } catch (err) {

    console.error(333, err);
  }

  //属性合并
  //在dev模式下，注释被保留，并且模板也是可能的
  //在根元素旁边添加注释，使其成为片段
  let root = result
  let setRoot = undefined

  if (
    __DEV__ &&
    result.patchFlag > 0 &&
    result.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
  ) {
    console.error(`__DEV__`,);
  }

  // props attrs
  // 例： createApp(App, { name: 'ddd'  })
  // fallthroughAttrs ： { name: 'ddd'  }
  if (fallthroughAttrs && inheritAttrs !== false) {
    const keys = Object.keys(fallthroughAttrs)
    const { shapeFlag } = root
    if (keys.length) { 
      console.error(fallthroughAttrs);
    }
  }

  if (
    __COMPAT__ &&
    isCompatEnabled(DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE, instance) &&
    vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT &&
    root.shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)
  ) { 
    console.error(`__COMPAT__`,);
  }

  // directives
  if (vnode.dirs) { 
    console.error(``,vnode.dirs);
  }

  // transition
  if (vnode.transition) { 
    console.error(``,vnode.dirs);
  }

  if (__DEV__ && setRoot) {
    setRoot(root)
  } else {
    result = root
  }

  setCurrentRenderingInstance(prev)
  
  console.log(print(filename, 'renderComponentRoot', `通过代理对象调用了组件的render函数`), result);
  return result
}



export function filterSingleRoot(
  children: any
): any | undefined {
  let singleRoot
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isVNode(child)) {
      // ignore user comment
      if (child.type !== Comment || child.children === 'v-if') {
        if (singleRoot) {
          // has more than 1 non-comment child, return now
          return
        } else {
          singleRoot = child
        }
      }
    } else {
      return
    }
  }
  return singleRoot
}