import { isFunction } from "@vue/shared"






let compile:undefined


// dev only
export const isRuntimeOnly = () => !compile




export function isClassComponent(value: unknown) {
    return isFunction(value) && '__vccOpts' in value
  }