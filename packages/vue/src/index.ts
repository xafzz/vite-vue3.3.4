import { registerRuntimeCompiler } from '@vue/runtime-core'




// 缓存
const compileCache: Record<string, any> = Object.create(null)

function compileToFunction(
    template: string | HTMLElement,
    options?: any
) {
    
  console.log(223332,options,template)
    
}

registerRuntimeCompiler(compileToFunction)

export { compileToFunction as compile }
export * from '@vue/runtime-dom'
