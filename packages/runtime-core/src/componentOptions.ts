import { extend, isArray, isFunction, isObject } from "@vue/shared"
import { normalizePropsOrEmits } from "./apiSetupHelpers"
import { DeprecationTypes, isCompatEnabled } from "./compat/compatConfig"
import { deepMergeData } from "./compat/data"


export let shouldCacheAccess = true

/**
 * 解析合并选项并将其缓存在组件上。
 * 每个组件仅执行一次，因为合并不涉及
 * 实例。
 */
export function resolveMergedOptions(
  instance: any
): any {
  const base = instance.type as any
  const { mixins, extends: extendsOptions } = base
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies }
  } = instance.appContext
  const cached = cache.get(base)

  let resolved: any

  if (cached) {
    resolved = cached
  } else if (!globalMixins.length && !mixins && !extendsOptions) {
    if (
      __COMPAT__ &&
      isCompatEnabled(DeprecationTypes.PRIVATE_APIS, instance)
    ) {
      resolved = extend({}, base) as any
      resolved.parent = instance.parent && instance.parent.proxy
      resolved.propsData = instance.vnode.props
    } else {
      resolved = base as any
    }
  } else {
    resolved = {}
    if (globalMixins.length) {
      globalMixins.forEach(m =>
        mergeOptions(resolved, m, optionMergeStrategies, true)
      )
    }
    mergeOptions(resolved, base, optionMergeStrategies)
  }
  if (isObject(base)) {
    cache.set(base, resolved)
  }
  return resolved
}

export function mergeOptions(
  to: any,
  from: any,
  strats: Record<string, any>,
  asMixin = false
) {
  if (__COMPAT__ && isFunction(from)) {
    from = from.options
  }

  const { mixins, extends: extendsOptions } = from

  if (extendsOptions) {
    mergeOptions(to, extendsOptions, strats, true)
  }
  if (mixins) {
    mixins.forEach((m: any) =>
      mergeOptions(to, m, strats, true)
    )
  }

  for (const key in from) {
    if (asMixin && key === 'expose') {
      __DEV__ &&
        console.warn(
          `"expose" option is ignored when declared in mixins or extends. ` +
          `It should only be declared in the base component itself.`
        )
    } else {
      const strat = internalOptionMergeStrats[key] || (strats && strats[key])
      to[key] = strat ? strat(to[key], from[key]) : from[key]
    }
  }
  return to
}

export const internalOptionMergeStrats: Record<string, Function> = {
  data: mergeDataFn,
  props: mergeEmitsOrPropsOptions,
  emits: mergeEmitsOrPropsOptions,
  // objects
  methods: mergeObjectOptions,
  computed: mergeObjectOptions,
  // lifecycle
  beforeCreate: mergeAsArray,
  created: mergeAsArray,
  beforeMount: mergeAsArray,
  mounted: mergeAsArray,
  beforeUpdate: mergeAsArray,
  updated: mergeAsArray,
  beforeDestroy: mergeAsArray,
  beforeUnmount: mergeAsArray,
  destroyed: mergeAsArray,
  unmounted: mergeAsArray,
  activated: mergeAsArray,
  deactivated: mergeAsArray,
  errorCaptured: mergeAsArray,
  serverPrefetch: mergeAsArray,
  // assets
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  // watch
  watch: mergeWatchOptions,
  // provide / inject
  provide: mergeDataFn,
  inject: mergeInject
}


function mergeDataFn(to: any, from: any) {
  if (!from) {
    return to
  }
  if (!to) {
    return from
  }
  return function mergedDataFn(this: any) {
    return (
      __COMPAT__ && isCompatEnabled(DeprecationTypes.OPTIONS_DATA_MERGE, null)
        ? deepMergeData
        : extend
    )(
      isFunction(to) ? to.call(this, this) : to,
      isFunction(from) ? from.call(this, this) : from
    )
  }
}

function mergeInject(
  to: any | undefined,
  from: any
) {
  return mergeObjectOptions(normalizeInject(to), normalizeInject(from))
}

function normalizeInject(
  raw: any | undefined
): any | undefined {
  if (isArray(raw)) {
    const res: any = {}
    for (let i = 0; i < raw.length; i++) {
      res[raw[i]] = raw[i]
    }
    return res
  }
  return raw
}

function mergeAsArray<T = Function>(to: T[] | T | undefined, from: T | T[]) {
  return to ? [...new Set([].concat(to as any, from as any))] : from
}

function mergeObjectOptions(to: Object | undefined, from: Object | undefined) {
  return to ? extend(Object.create(null), to, from) : from
}

function mergeEmitsOrPropsOptions(
  to: any | undefined,
  from: any | undefined
): any | undefined
function mergeEmitsOrPropsOptions(
  to: any | undefined,
  from: any | undefined
): any | undefined
function mergeEmitsOrPropsOptions(
  to: any | undefined,
  from: any | undefined
) {
  if (to) {
    if (isArray(to) && isArray(from)) {
      return [...new Set([...to, ...from])]
    }
    return extend(
      Object.create(null),
      normalizePropsOrEmits(to),
      normalizePropsOrEmits(from ?? {})
    )
  } else {
    return from
  }
}

function mergeWatchOptions(
  to: any | undefined,
  from: any | undefined
) {
  if (!to) return from
  if (!from) return to
  const merged = extend(Object.create(null), to)
  for (const key in from) {
    merged[key] = mergeAsArray(to[key], from[key])
  }
  return merged
}
