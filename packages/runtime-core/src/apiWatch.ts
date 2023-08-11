import { ReactiveFlags, Ref, isReactive, isRef, isShallow } from "@vue/reactivity"
import { EMPTY_OBJ, extend, isArray, isFunction, isMap, isObject, isPlainObject, isSet, isString } from "@vue/shared"
import { currentInstance, getCurrentInstance } from "./component"
import { ErrorCodes, callWithAsyncErrorHandling, callWithErrorHandling } from "./errorHandling"
import { checkCompatEnabled } from "@vue/compiler-core"
import { DeprecationTypes } from "./compat/compatConfig"



// this.$watch
export function instanceWatch(
  this: any,
  source: string | Function,
  value: any,
  options?: any
): any {
  
  console.error(`instanceWatch`,'watch');
}


export function createPathGetter(ctx: any, path: string) {
  const segments = path.split('.')
  return () => {
    let cur = ctx
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i]]
    }
    return cur
  }
}

export function traverse(value: unknown, seen?: Set<unknown>) {
  if (!isObject(value) || (value as any)[ReactiveFlags.SKIP]) {
    return value
  }
  seen = seen || new Set()
  if (seen.has(value)) {
    return value
  }
  seen.add(value)
  if (isRef(value)) {
    traverse(value.value, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen)
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v: any) => {
      traverse(v, seen)
    })
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], seen)
    }
  }
  return value
}
