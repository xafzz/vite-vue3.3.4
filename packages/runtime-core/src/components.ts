import { isFunction, print } from "@vue/shared"



const filename = 'runtime-core/apiCreateApp.ts'



type CompileFunction = (
  template: string | object,
  options?: any
) => any

let compile: CompileFunction | undefined
let installWithProxy: (i: any) => void

// runtime-dom 注册编译器
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
  installWithProxy = i => {
    if (i.render!._rc) {
      console.error(print(filename, `registerRuntimeCompiler`),);
    }
  }
}

// dev only
export const isRuntimeOnly = () => !compile




export function isClassComponent(value: unknown) {
    return isFunction(value) && '__vccOpts' in value
  }