import { EMPTY_ARR, EMPTY_OBJ, camelize, def, extend, hasOwn, hyphenate, isArray, isFunction, isObject, isReservedProp, isString } from "@vue/shared";
import { Data, setCurrentInstance, unsetCurrentInstance } from "./component";
import { InternalObjectKey } from "./vnode";
import { shallowReactive, toRaw } from "@vue/reactivity";
import { isEmitListener } from "./componentEmits";
import { DeprecationTypes, isCompatEnabled } from "./compat/compatConfig";
import { createPropsDefaultThis } from "./compat/props";


export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>

type DefaultFactory<T> = (props: Data) => T | null | undefined

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined
] // if is function with args, allowing non-required functions
  ? { new(): TConstructor; (): T; readonly prototype: TConstructor } // Create Function like constructor
  : never

type PropConstructor<T = any> =
  | { new(...args: any[]): T & {} }
  | { (): T }
  | PropMethod<T>

export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

export interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: D | DefaultFactory<D> | null | undefined | object
  validator?(value: unknown): boolean
  /**
   * @internal
   */
  skipCheck?: boolean
  /**
   * @internal
   */
  skipFactory?: boolean
}

const enum BooleanFlags {
  shouldCast,
  shouldCastTrue
}


type NormalizedProp =
  | null
  | (PropOptions & {
    [BooleanFlags.shouldCast]?: boolean
    [BooleanFlags.shouldCastTrue]?: boolean
  })

// normalized value is a tuple of the actual normalized options
// and an array of prop keys that need value casting (booleans and defaults)
export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []

// props
export function normalizePropsOptions(
  comp: any,
  appContext: any,
  asMixin = false
): NormalizedPropsOptions {

  const cache = appContext.propsCache
  const cached = cache.get(comp)
  if (cached) {
    return cached
  }

  const raw = comp.props
  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []

  // apply mixin/extends props
  let hasExtends = false
  if (!isFunction(comp)) { //__FEATURE_OPTIONS_API__
    const extendProps = (raw: any) => {
      if (__COMPAT__ && isFunction(raw)) {
        raw = raw.options
      }
      hasExtends = true
      const [props, keys] = normalizePropsOptions(raw, appContext, true)
      extend(normalized, props)
      if (keys) needCastKeys.push(...keys)
    }
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps)
    }
    if (comp.extends) {
      extendProps(comp.extends)
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendProps)
    }
  }

  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      cache.set(comp, EMPTY_ARR as any)
    }
    console.log(`normalizePropsOptions->props`, EMPTY_ARR);
    return EMPTY_ARR as any
  }

  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && !isString(raw[i])) {
        console.warn(`props must be strings when using array syntax.`, raw[i])
      }
      const normalizedKey = camelize(raw[i])
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else if (raw) {
    if (__DEV__ && !isObject(raw)) {
      console.warn(`invalid props options`, raw)
    }
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (validatePropName(normalizedKey)) {
        const opt = raw[key]
        const prop: NormalizedProp = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt))
        if (prop) {
          const booleanIndex = getTypeIndex(Boolean, prop.type)
          const stringIndex = getTypeIndex(String, prop.type)
          prop[BooleanFlags.shouldCast] = booleanIndex > -1
          prop[BooleanFlags.shouldCastTrue] =
            stringIndex < 0 || booleanIndex < stringIndex
          // if the prop needs boolean casting or default value
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            needCastKeys.push(normalizedKey)
          }
        }
      }
    }
  }

  const res: NormalizedPropsOptions = [normalized, needCastKeys]
  if (isObject(comp)) {
    cache.set(comp, res)
  }
  console.log(`normalizePropsOptions->props`, res);
  return res
}



function validatePropName(key: string) {
  if (key[0] !== '$') {
    return true
  } else if (__DEV__) {
    console.warn(`Invalid prop name: "${key}" is a reserved property.`)
  }
  return false
}

//使用函数字符串名称检查类型构造函数
//因此它可以跨vms/iframe工作。
function getType(ctor: Prop<any>): string {
  const match = ctor && ctor.toString().match(/^\s*(function|class) (\w+)/)
  return match ? match[2] : ctor === null ? 'null' : ''
}

function isSameType(a: Prop<any>, b: Prop<any>): boolean {
  return getType(a) === getType(b)
}

function getTypeIndex(
  type: Prop<any>,
  expectedTypes: PropType<any> | void | null | true
): number {
  if (isArray(expectedTypes)) {
    return expectedTypes.findIndex(t => isSameType(t, type))
  } else if (isFunction(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  return -1
}


export function initProps(
  instance: any,
  rawProps: Data | null, // props
  isStateful: number, // 位运算结果
  isSSR = false
) {

  const props: Data = {}
  const attrs: Data = {}
  // attrs上定义了一个标记 __vInternal: 1
  def(attrs, InternalObjectKey, 1)

  instance.propsDefaults = Object.create(null)

  setFullProps(instance, rawProps, props, attrs)

  // ensure all declared prop keys are present
  for (const key in instance.propsOptions[0]) {
    if (!(key in props)) {
      props[key] = undefined
    }
  }

  // validation
  if (__DEV__) {
    console.error(`validateProps(rawProps || {}, props, instance)`);
  }

  if (isStateful) {
    // stateful
    instance.props = isSSR ? props : shallowReactive(props)
  } else {
    if (!instance.type.props) {
      // functional w/ optional props, props === attrs
      instance.props = attrs
    } else {
      // functional w/ declared props
      instance.props = props
    }
  }
  instance.attrs = attrs
}

// 拆分props、attrs，并对default做了处理，prop大小写进行了处理
function setFullProps(
  instance: any,
  rawProps: Data | null,
  props: Data,
  attrs: Data
) {

  const [options, needCastKeys] = instance.propsOptions
  let hasAttrsChanged = false
  let rawCastValues: Data | undefined

  // props
  if (rawProps) {
    for (let key in rawProps) {
      // key，ref是保留的，永远不会传下去
      // key是否在
      if (isReservedProp(key)) {
        continue
      }

      if (__COMPAT__) {
        console.error(`__COMPAT__`,);
      }

      // props value
      const value = rawProps[key]

      // prop选项在规范化过程中被camelized骆驼化，
      // 我们需要骆驼化密钥。
      let camelKey
      // options拥有首字母大写后的key，那么就是需要转换的
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        // 如果需要转换的key不存在，或者不在需要转换的key包含camlekey
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          // 转换key
          props[camelKey] = value
        } else {
          ; (rawCastValues || (rawCastValues = {}))[camelKey] = value
        }
      }
      // 如果不在props和emit里面，那么就到attrs里面去
      else if (!isEmitListener(instance.emitsOptions, key)) {
        // 任何未声明（作为道具或已发射事件）的道具都会放入单独的“attrs”对象中进行传播。确保保留原钥匙套
        if (__COMPAT__) {
          console.error(`__COMPAT__`,);
        }
        // 如果key不在attrs中
        if (!(key in attrs) || value !== attrs[key]) {
          // 将key设置为attrs
          attrs[key] = value
          hasAttrsChanged = true
        }
      }

      if (needCastKeys) {
        const rawCurrentProps = toRaw(props)
        const castValues = rawCastValues || EMPTY_OBJ
        for (let i = 0; i < needCastKeys.length; i++) {
          const key = needCastKeys[i]
          //  处理default
          props[key] = resolvePropValue(
            options!,
            rawCurrentProps,
            key,
            castValues[key],
            instance,
            !hasOwn(castValues, key)
          )
        }
      }
      return hasAttrsChanged
    }
  }
}

// 处理defaultProps
function resolvePropValue(
  options: NormalizedProps,
  props: Data,
  key: string,
  value: unknown,
  instance: any,
  isAbsent: boolean
) {
  // 需要cast的key
  const opt = options[key]
  if (opt != null) {
    // 判断是否有default
    const hasDefault = hasOwn(opt, 'default')
    // default values
    // 如果有default，并且value为空
    if (hasDefault && value === undefined) {
      // 将deafult传给defaultValue
      const defaultValue = opt.default
      // 如果type不是函数 并且 默认值是函数
      if (
        opt.type !== Function &&
        !opt.skipFactory &&
        isFunction(defaultValue)
      ) {
        // 解构出propsDefaults
        const { propsDefaults } = instance
        // 如果key在propsDefaults中
        if (key in propsDefaults) {
          // 直接拿出值
          value = propsDefaults[key]
        } else {
          // 如果key不在propsDefaults中
          setCurrentInstance(instance)
          // 调用默认值函数返回默认值
          value = propsDefaults[key] = defaultValue.call(
            __COMPAT__ &&
              isCompatEnabled(DeprecationTypes.PROPS_DEFAULT_THIS, instance) 
              ? createPropsDefaultThis(instance, props, key) 
              : null,
            props
          )
          unsetCurrentInstance() 
        }
      } else {
        // 默认值赋给值
        value = defaultValue
      }
    }
    // boolean casting
    if (opt[BooleanFlags.shouldCast]) {
      if (isAbsent && !hasDefault) {
        value = false
      } else if (
        opt[BooleanFlags.shouldCastTrue] &&
        (value === '' || value === hyphenate(key))
      ) {
        value = true
      }
    }
  }
  return value
}