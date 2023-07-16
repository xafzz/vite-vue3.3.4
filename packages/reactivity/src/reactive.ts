import { isObject, print, toRawType } from "@vue/shared"
import { mutableHandlers, readonlyHandlers, shallowReactiveHandlers, shallowReadonlyHandlers } from './baseHandlers'
import { mutableCollectionHandlers, readyonlyCollectionHandlers, shallowCollectionHandlers, shallowReadonlyCollectionHandlers } from "./collectionHandlers"

const filename = 'reativity/reactive.ts'

export const enum ReactiveFlags {
    SKIP = '__v_skip',
    IS_REACTIVE = '__v_isReactive',
    IS_READONLY = '__v_isReadonly',
    IS_SHALLOW = '__v_isShallow',
    RAW = '__v_raw'
}


export interface Target {
    [ReactiveFlags.SKIP]?: boolean
    [ReactiveFlags.IS_REACTIVE]?: boolean
    [ReactiveFlags.IS_READONLY]?: boolean
    [ReactiveFlags.IS_SHALLOW]?: boolean
    [ReactiveFlags.RAW]?: any
}
// key 必须是对象 自动垃圾回收
export const reactiveMap = new WeakMap<Target, any>()
export const shallowReactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()
export const shallowReadonlyMap = new WeakMap<Target, any>()


const enum TargetType {
    INVALID = 0,
    COMMON = 1,
    COLLECTION = 2
}

function targetTypeMap(rawType: string) {
    switch (rawType) {
        case 'Object':
        case 'Array':
            return TargetType.COMMON
        case 'Map':
        case 'Set':
        case 'WeakMap':
        case 'WeakSet':
            return TargetType.COLLECTION
        default:
            return TargetType.INVALID   // 不能代理
    }
}

function getTargetType(value: Target) {
    return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
        ? TargetType.INVALID
        : targetTypeMap(toRawType(value))
}

// 响应式
export function reactive(target) {
    // 不能是只读
    if (isReadonly(target)) {
        return target
    }

    return createReactiveObject(
        target,
        false,
        mutableHandlers,
        mutableCollectionHandlers,
        reactiveMap
    )
}
// 第一层响应式
export function shallowReactive(target) {

    return createReactiveObject(
        target,
        false,
        shallowReactiveHandlers,
        shallowCollectionHandlers,
        shallowReactiveMap
    )
}
// 只读的  深层也是只读
export function readonly(target) {
    return createReactiveObject(
        target,
        true,
        readonlyHandlers,
        readyonlyCollectionHandlers,
        readonlyMap
    )
}

// 第一层只读
export function shallowReadonly(target) {
    return createReactiveObject(
        target,
        true,
        shallowReadonlyHandlers,
        shallowReadonlyCollectionHandlers,
        shallowReadonlyMap
    )
}

function createReactiveObject(
    target, // 被代理的对象
    isReadonly, // 是不是只读
    baseHandlers, // proxy 的捕获器
    collectionHandlers, // 针对集合的proxy捕获器
    proxyMap    // 一个用于缓存的proxy的weekMap对象
) {

    // 不是 object 直接返回 target
    if (!isObject(target)) {
        if (__DEV__) {
            console.warn(`不能变为reactive模式：${String(target)}`);
        }
        return target
    }
    // 已经被代理了 直接返回 target
    // reactive(readonly(obj))是个例外
    if (
        // ref
        target[ReactiveFlags.RAW] &&
        !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
    ) {
        return target
    }
    // 是否已经代理
    // 尝试从proxyMap中获取缓存的proxy对象
    // 为什么缓存
    // 避免对同一个对象进行多次代理造成的资源浪费，
    // 保证相同对象被代理多次后，代理对象保持一致
    const existingProxy = proxyMap.get(target)
    if (existingProxy) {
        return existingProxy
    }
    // 只能观察特定类型的值 object array set map WeekSet WeekMap
    const targetType = getTargetType(target)
    if (targetType === TargetType.INVALID) {
        return target
    }
    /**
     * target不能被代理的情况有三种：
     * 1、 显示声明对象不可被代理（通过向对象添加__v_skip: true属性）或使用markRaw标记的对象
     * 2、 对象为不可扩展对象：如通过Object.freeze、Object.seal、Object.preventExtensions的对象
     * 3、 除了Object、Array、Map、Set、WeakMap、WeakSet之外的其他类型的对象，如Date、RegExp、Promise等
     */
    /**
     * 分成两种handler
     * 例：捕获修改操作进行依赖触发
     * Object 可以直接通过 set（或 deleteProperty） 捕获器
     * Array 是可以通过pop，push等方法是进行修改数组 需要单独处理
     * 集合 通过捕获 get 方法来处理修改操作
     */
    const proxy = new Proxy(
        target,
        //                                  set map weekSet weekMap  Object Array
        targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
    )
    proxyMap.set(target,proxy)
    console.log(print(filename, 'createReactiveObject',), proxy);
    return proxy
}

// 根据返回原始对象
export function toRaw<T>(observed: T): T {
    const raw = observed && (observed as Target)[ReactiveFlags.RAW]
    const result = raw ? toRaw(raw) : observed
    // console.log(print(filename, 'toRaw', `返回原始对象:`),result);
    return result
}

export const toReactive = value => {
    const isObj = isObject(value)
    console.log(print(filename, 'toReactive', `${isObj ? '是Object->reactive()' : '不是Object,返回:' + value}`), value);
    return isObj ? reactive(value) : value
}


/**
 * Checks if an object is a proxy created by {@link reactive()} or
 * {@link shallowReactive()} (or {@link ref()} in some cases).
 *
 * @example
 * ```js
 * isReactive(reactive({}))            // => true
 * isReactive(readonly(reactive({})))  // => true
 * isReactive(ref({}).value)           // => true
 * isReactive(readonly(ref({})).value) // => true
 * isReactive(ref(true))               // => false
 * isReactive(shallowRef({}).value)    // => false
 * isReactive(shallowReactive({}))     // => true
 * ```
 *
 * @param value - The value to check.
 * @see {@link https://vuejs.org/api/reactivity-utilities.html#isreactive}
 */
export function isReactive(value: unknown): boolean {
    let result
    if (isReadonly(value)) {
        result= isReactive((value as Target)[ReactiveFlags.RAW])
    } else { 
        result = !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
    }
    console.log(print(filename, 'isReactive', `${result}`), value);
    return result
}

export function isReadonly(value: unknown): boolean {
    const result = !!(value && value[ReactiveFlags.IS_READONLY])
    // console.log(print(filename, 'isReadonly', `isReadonly: ${result}`), value);
    return result
}

export function isShallow(value: unknown): boolean {
    const result = !!(value && value[ReactiveFlags.IS_SHALLOW])
    // console.log(print(filename, 'isShallow', `'${value}' isShallow: ${result}`), value);
    return result
}