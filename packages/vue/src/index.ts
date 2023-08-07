import { compile } from '@vue/compiler-dom';
import { parse } from '@vue/compiler-sfc';
import { registerRuntimeCompiler } from '@vue/runtime-core'
import { NOOP, extend, isString,normalizeClass,toDisplayString } from '@vue/shared'
import { generateCodeFrame } from 'packages/shared/src/codeframe';

// 缓存
const compileCache: Record<string, any> = Object.create(null)

// 注册运行时的模版编译函数，并最终生成模版函数。
function compileToFunction(
  template: string | any, // | HTMLElement,
  options?: any
) {

  // 如果传入的参数不是字符串
  if (!isString(template)) {
    // 是HTML DOM，nodeType是DOM的属性
    if (template.nodeType) {
      // 将dom内的html作为模版
      template = template.innerHTML;
    }
    else {
      console.warn(`invalid template option: `, template);
      return NOOP;
    }
  }

  const key = template
  const cached = compileCache[key]
  if (cached) {
    return cached
  }

  // #app
  if (template[0] === '#') {
    console.error(`template[0] === '#'`,);
  }

  // 合并 options
  const opts = extend(
    {
      hoistStatic: true,  // 静态提升
      onError: __DEV__ ? onError : undefined,
      onWarn: __DEV__ ? e => onError(e, true) : NOOP
    } as any,
    options
  )

  function onError(err, asWarning = false) {
    const message = asWarning
      ? err.message
      : `Template compilation error: ${err.message}`
    const codeFrame =
      err.loc &&
      generateCodeFrame(
        template as string,
        err.loc.start.offset,
        err.loc.end.offset
      )
    console.warn(codeFrame ? `${message}\n${codeFrame}` : message)
  }

  // 自定义 element
  if (!opts.isCustomElement && typeof customElements !== 'undefined') {
    opts.isCustomElement = tag => !!customElements.get(tag)
  }

  // 没有用vue-loader 所以将 style 跟 script 剔除
  // const vueObject = parse(template)
  // const templateAst = vueObject.descriptor.template.ast

  const result = compile(template, opts)
  return {
    ...result,
    code: result.code.replace(
      /\nexport (function|const) (render|ssrRender)/,
      "\n$1 _sfc_$2"
    )
  }
}


registerRuntimeCompiler(compileToFunction)

export { compileToFunction as compile }
export * from '@vue/runtime-dom'
export * from '@vue/runtime-core'

export { parse,normalizeClass,toDisplayString }
