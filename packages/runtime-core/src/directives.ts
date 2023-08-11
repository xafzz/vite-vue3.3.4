/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return withDirectives(h(comp), [
  [foo, this.x],
  [bar, this.y]
])
*/

import { EMPTY_OBJ, isFunction } from "@vue/shared"
import { getExposeProxy } from "./componentPublicInstance"
import { currentRenderingInstance } from "./componentRenderContext"
import { traverse } from "./apiWatch"
import { Data } from "./component"
import { mapCompatDirectiveHook } from "./compat/customDirective"
import { pauseTracking, resetTracking } from "@vue/reactivity"
import { ErrorCodes, callWithAsyncErrorHandling } from "./errorHandling"



/**
 * Adds directives to a any.
 */
export function withDirectives(
  vnode: any,
  directives: any
) {
  const internalInstance = currentRenderingInstance
  if (internalInstance === null) {
    __DEV__ && console.warn(`withDirectives can only be used inside render functions.`)
    return vnode
  }
  const instance =
    (getExposeProxy(internalInstance) as any) ||
    // @ts-ignore
    internalInstance.proxy
  const bindings: any[] = vnode.dirs || (vnode.dirs = [])
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i]
    if (dir) {
      if (isFunction(dir)) {
        dir = {
          mounted: dir,
          updated: dir
        } as any
      }
      if (dir.deep) {
        traverse(value)
      }
      bindings.push({
        dir,
        instance,
        value,
        oldValue: void 0,
        arg,
        modifiers
      })
    }
  }
  return vnode
}

export interface DirectiveBinding<V = any> {
  instance: any | null
  value: V
  oldValue: V | null
  arg?: string
  modifiers: any
  dir: ObjectDirective<any, V>
}

export type DirectiveHook<T = any, Prev = any | null, V = any> = (
  el: T,
  binding: DirectiveBinding,
  vnode: any,
  prevVNode: Prev
) => void

export type SSRDirectiveHook = (
  binding: DirectiveBinding,
  vnode: any
) => Data | undefined

export interface ObjectDirective<T = any, V = any> {
  created?: DirectiveHook<T, null, V>
  beforeMount?: DirectiveHook<T, null, V>
  mounted?: DirectiveHook<T, null, V>
  beforeUpdate?: DirectiveHook<T, any, V>
  updated?: DirectiveHook<T, any, V>
  beforeUnmount?: DirectiveHook<T, null, V>
  unmounted?: DirectiveHook<T, null, V>
  getSSRProps?: SSRDirectiveHook
  deep?: boolean
}

export function invokeDirectiveHook(
  vnode: any,
  prevVNode: any | null,
  instance: any | null,
  name: keyof ObjectDirective
) {
  const bindings = vnode.dirs!
  const oldBindings = prevVNode && prevVNode.dirs!
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value
    }
    let hook = binding.dir[name] as DirectiveHook | DirectiveHook[] | undefined
    if (__COMPAT__ && !hook) {
      hook = mapCompatDirectiveHook(name, binding.dir, instance)
    }
    if (hook) {
      // disable tracking inside all lifecycle hooks
      // since they can potentially be called inside effects.
      pauseTracking() 
      callWithAsyncErrorHandling(hook, instance, ErrorCodes.DIRECTIVE_HOOK, [
        vnode.el,
        binding,
        vnode,
        prevVNode
      ])
      resetTracking()
    }
  }
}