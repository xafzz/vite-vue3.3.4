import { createAppContext } from './apiCreateApp'
import { EffectScope, markRaw, proxyRefs } from '@vue/reactivity'
import { initProps, normalizePropsOptions } from './componentProps'
import { emit, normalizeEmitsOptions } from './componentEmits'
import { EMPTY_OBJ, NOOP, ShapeFlags, isFunction, print } from '@vue/shared'
import { PublicInstanceProxyHandlers, RuntimeCompiledPublicInstanceProxyHandlers, createDevRenderContext, publicPropertiesMap } from './componentPublicInstance'
import { currentRenderingInstance } from './componentRenderContext'
import { initSlots } from './componentSlots'


const filename = 'runtime-core/renderer.ts'


type CompileFunction = (
  template: string | object,
  options?: any
) => any

let compile: CompileFunction | undefined
let installWithProxy: (i: any) => void

let internalSetCurrentInstance: any
let globalCurrentInstanceSetters: any[]
let settersKey = '__VUE_INSTANCE_SETTERS__'

// runtime-dom 注册编译器
export function registerRuntimeCompiler(_compile: any) {
  compile = _compile
  installWithProxy = i => {
    // if (i.render!._rc) {
      i.withProxy = new Proxy(i.ctx, RuntimeCompiledPublicInstanceProxyHandlers)
    // }
  }
}

// dev only
export const isRuntimeOnly = () => !compile


export type Data = Record<string, unknown>

const emptyAppContext = createAppContext()

let uid = 0

export function createComponentInstance(
  vnode: any,
  parent: any | null,
  suspense: any | null
) {
  const type = vnode.type as any
  // inherit parent app context - or - if root, adopt from root vnode
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext

  const instance: any = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null!, // to be immediately set
    next: null,
    subTree: null!, // will be set synchronously right after creation
    effect: null!,
    update: null!, // will be set synchronously right after creation
    scope: new EffectScope(true /* detached */),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    accessCache: null!,
    renderCache: [],

    // local resolved assets
    components: null,
    directives: null,

    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),

    // emit
    emit: null!, // to be set immediately
    emitted: null,

    // props default value
    propsDefaults: EMPTY_OBJ,

    // inheritAttrs
    inheritAttrs: type.inheritAttrs,

    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,

    attrsProxy: null,
    slotsProxy: null,

    // suspense related
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,

    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null
  }
  if (__DEV__) {
    instance.ctx = createDevRenderContext(instance)
  } else {
    instance.ctx = { _: instance }
  }
  instance.root = parent ? parent.root : instance
  instance.emit = emit.bind(null, instance)

  // apply custom element special handling
  if (vnode.ce) {
    vnode.ce(instance)
  }

  console.log(print(filename, `createComponentInstance`, `组件实例对象`), instance);
  return instance
}

const classifyRE = /(?:^|[-_])(\w)/g
const classify = (str: string): string =>
  str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

export function getComponentName(
  Component: any,
  includeInferred = true
): string | false | undefined {
  return isFunction(Component)
    ? Component.displayName || Component.name
    : Component.name || (includeInferred && Component.__name)
}

export function formatComponentName(
  instance: any | null,
  Component: any,
  isRoot = false
): string {
  let name = getComponentName(Component)
  if (!name && Component.__file) {
    const match = Component.__file.match(/([^/\\]+)\.\w+$/)
    if (match) {
      name = match[1]
    }
  }

  if (!name && instance && instance.parent) {
    // try to infer the name based on reverse resolution
    const inferFromRegistry = (registry: Record<string, any> | undefined) => {
      for (const key in registry) {
        if (registry[key] === Component) {
          return key
        }
      }
    }
    name =
      inferFromRegistry(
        instance.components ||
        (instance.parent.type as any).components
      ) || inferFromRegistry(instance.appContext.components)
  }

  return name ? classify(name) : isRoot ? `App` : `Anonymous`
}


export function isClassComponent(value: unknown): value is any {
  return isFunction(value) && '__vccOpts' in value
}


export let currentInstance: any | null = null

export const getCurrentInstance: () => any | null = () =>
  currentInstance || currentRenderingInstance


export let isInSSRComponentSetup = false


export function isStatefulComponent(instance: any) {
  return instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
}

// 处理setup：这个函数里使用其它方法，初始化了props和插槽，且调用了setup
export function setupComponent(instance: any, isSSR = false) {
  // ssr false
  isInSSRComponentSetup = isSSR

  const { props, children } = instance.vnode

  // 判断insatce组件实例是否是stateful
  const isStateful = isStatefulComponent(instance)

  // 初始化并拆分props、attrs，并对default做了处理，prop大小写进行了处理
  // defineProps
  initProps(instance, props, isStateful, isSSR)
  // 初始化slots
  initSlots(instance, children)

  // <script> 内 code 
  const setupResult = isStateful
    ? setupStatefulComponent(instance, isSSR)
    : undefined
  isInSSRComponentSetup = false

  return setupResult
}

// 初始化组件实例，根据setup参数初始化setupContext，调用setup，
// 然后对setupResult进行handleSetupResult处理: instance实例上获得setupState 和 render函数
function setupStatefulComponent(
  instance: any,
  isSSR: boolean
) {
  // render 函数
  const Component = instance.type as any

  if (__DEV__) {
    console.error(`__DEV__`,);
  }

  // 0. create render proxy property access cache
  instance.accessCache = Object.create(null)
  // 1. create public instance / render proxy
  // also mark it raw so it's never observed
  instance.proxy = markRaw(new Proxy(instance.ctx, PublicInstanceProxyHandlers))

  // 2. call setup()
  const { setup } = Component
  if (setup) {
    console.error(`if ( setup )`,);
  } else {
    finishComponentSetup(instance, isSSR)
  }
}

export const setCurrentInstance = (instance: any) => {
  internalSetCurrentInstance(instance)
  instance.scope.on()
}

export const unsetCurrentInstance = () => {
  currentInstance && currentInstance.scope.off()
  internalSetCurrentInstance(null)
}

// 初始化render函数
export function finishComponentSetup(
  instance: any,
  isSSR: boolean,
  skipOptions?: boolean
) {
  const Component = instance.type as any

  if (__COMPAT__) {
    console.error(`__COMPAT__`,);
  }

  // template / render function normalization
  // could be already set when returned from setup()
  if (!instance.render) {
    // 如果不是srr compile存在， render函数不存在
    if (!isSSR && compile && !Component.render) {
      console.error(!isSSR && compile && !Component.render);
    }
    // 赋值instance.render
    instance.render = (Component.render || NOOP) as any

    // 对于使用 `with` 块的运行时编译的渲染函数，渲染
    // 使用的代理需要不同的 `has` 处理程序，它的性能更高并且
    // 也只允许全局白名单失效。
    if (installWithProxy) {
      installWithProxy(instance)
    }

    // 对vue2.0的支持
    if (__FEATURE_OPTIONS_API__ && !(__COMPAT__ && skipOptions)) {
      console.error(``, '对vue2.0的支持');
    }
  }
  // warn missing template/render
  // the runtime compilation of template in SSR is done by server-render
  if (__DEV__ && !Component.render && instance.render === NOOP && !isSSR) {
    /* istanbul ignore if */
    if (!compile && Component.template) {
      console.warn(
        `Component provided template option but ` +
        `runtime compilation is not supported in this build of Vue.` +
        (__ESM_BUNDLER__
          ? ` Configure your bundler to alias "vue" to "vue/dist/vue.esm-bundler.js".`
          : true
            ? ` Use "vue.esm-browser.js" instead.`
            : true
              ? ` Use "vue.global.js" instead.`
              : ``) /* should not happen */
      )
    } else {
      console.warn(`Component is missing template or render function.`)
    }
  }
}



export function getExposeProxy(instance: any) {
  if (instance.exposed) {
    return (
      instance.exposeProxy ||
      (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key: string) {
          if (key in target) {
            return target[key]
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance)
          }
        },
        has(target, key: string) {
          return key in target || key in publicPropertiesMap
        }
      }))
    )
  }
}