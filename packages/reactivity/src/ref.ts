import { IfAny, hasChanged, isArray, isFunction, isObject, print } from "@vue/shared";
import { isProxy, isReadonly, isShallow, toRaw, toReactive } from "./reactive";
import { activeEffect, getDepFromReactive, shouldTrack, trackEffects, triggerEffects } from "./effect";
import { Dep, createDep } from "./dep";
import { TrackOpTypes, TriggerOpTypes } from "./operations";

const filename = 'reativity/ref.ts'

declare const RefSymbol: unique symbol
export declare const RawSymbol: unique symbol

export interface Ref<T = any> {
    value: T
    /**
     * Type differentiator only.
     * We need this to be in public d.ts but don't want it to show up in IDE
     * autocomplete, so we use a private Symbol instead.
     */
    [RefSymbol]: true
}

// 收集依赖
export function trackRefValue(ref) {
    // shouldTrack :用做暂停和恢复捕获依赖的标志
    // activeEffect : 标记当前活跃的effect 
    if (shouldTrack && activeEffect) {
        // effect ReactiveEffect 实例里面有了
        ref = toRaw(ref)
        // 添加依赖
        if (__DEV__) {
            trackEffects(ref.dep || (ref.dep = createDep()), {
                target: ref,
                type: TrackOpTypes.GET,
                key: 'value'
            })
        } else {
            trackEffects(ref.dep || (ref.dep = createDep()))
        }
        console.log(print(filename, 'trackRefValue', `拿到dep通知trackEffects`), ref);
    }
}

// 触发ref的响应式更新
export function triggerRefValue(ref, newVal) {
    ref = toRaw(ref)
    const dep = ref.dep
    if (dep) {
        if (__DEV__) {
            triggerEffects(dep, {
                target: ref,
                type: TriggerOpTypes.SET,
                key: 'value',
                newValue: newVal
            })
        } else {
            triggerEffects(dep)
        }
        console.log(print(filename, 'triggerRefValue', `拿到dep通知trackEffects`), ref, dep);
    }
}

// 是不是Ref
export function isRef(r) {
    const result = !!(r && r.__v_isRef === true)
    // console.log(print(filename, 'isRef', '通过__v_isRef'), result);
    return result
}

// 是ref 返回.value，不是返回自身
export function unref(value) {
    return isRef(value) ? value.value : value
}

export function ref(value?: any) {
    console.log(print(filename, 'ref'), value);
    return createRef(value, false)
}

export function shallowRef(value?: any) {
    console.log(print(filename, 'shallowRef'), value);
    return createRef(value, true)
}

function createRef(rawValue: any, shallow: boolean) {
    // 是 ref 直接返回
    if (isRef(rawValue)) {
        return rawValue
    }
    const result = new RefImpl(rawValue, shallow)
    console.log(print(filename, 'createRef', 'new RefImpl()'), result);
    return result
}

class RefImpl {

    // 存贮会变更的值、当前值
    private _value
    // 保存原始的值
    private _rawValue

    // 存储依赖
    public dep?: Dep = undefined
    // 标识 是否是 ref
    public readonly __v_isRef = true

    constructor(value, public readonly __v_isShallow: boolean) {

        // toRaw 获取原始值
        this._rawValue = __v_isShallow ? value : toRaw(value)
        // 如果是 object 则走 reative
        this._value = __v_isShallow ? value : toReactive(value)
    }

    // 获取
    get value() {
        // 收集依赖
        trackRefValue(this)
        return this._value
    }

    // 设置
    set value(newVal) {

        const useDirectValue = this.__v_isShallow || isShallow(newVal) || isReadonly(newVal)
        // shallowRef或者 新值 是浅层的或者只读的，则设置值的之前对新值解包
        newVal = useDirectValue ? newVal : toRaw(newVal)

        // 对比新值和旧值，如果有改变则触发更新
        if (hasChanged(newVal, this._rawValue)) {
            this._rawValue = newVal
            this._value = useDirectValue ? newVal : toReactive(newVal)
            // 触发响应式的更新
            triggerRefValue(this, newVal)
        }
    }
}


export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>

export function toRef<T>(
    value: T
): T extends () => infer R
    ? Readonly<Ref<R>>
    : T extends Ref
    ? T
    : Ref<T>
export function toRef<T extends object, K extends keyof T>(
    object: T,
    key: K
): ToRef<T[K]>
export function toRef<T extends object, K extends keyof T>(
    object: T,
    key: K,
    defaultValue: T[K]
): ToRef<Exclude<T[K], undefined>>
export function toRef(
    source: Record<string, any> | MaybeRef,
    key?: string,
    defaultValue?: unknown
): Ref {
    if (isRef(source)) {
        return source
    } else if (isFunction(source)) { // toRef(() => props.foo)
        return new GetterRefImpl(source) as any
    } else if (isObject(source) && arguments.length > 1) { // toRef({age:1},'age')
        return propertyToRef(source, key!, defaultValue)
    } else {
        return ref(source);
    }
}

class GetterRefImpl<T>{
    public readonly __v_isRef = true
    public readonly __v_isReadonly = true

    constructor(private readonly _getter: () => T) { }

    get value() {
        console.log(print(filename, 'toRef', 'function'));
        return this._getter()
    }

}

function propertyToRef(
    source: Record<string, any>,
    key: string,
    defaultValue?: unknown
) {
    const val = source[key]
    return isRef(val) ? val : (new ObjectRefImpl(source, key, defaultValue) as any)
}

class ObjectRefImpl {

    public readonly __v_isRef = true

    constructor(
        private readonly _object,
        private readonly _key,
        private readonly _defaultValue
    ) { }

    get value() {
        const val = this._object[this._key]
        return val === undefined ? (this._defaultValue) : val
    }
    set value(newVal) {
        this._object[this._key] = newVal
    }
    get dep(): Dep | undefined {
        return getDepFromReactive(toRaw(this._object), this._key)
    }
}

export function toRefs(object) {
    if (__DEV__ && !isProxy(object)) {
        console.warn(`toRefs 期望是一个reactive对象，但是一个普通对象`)
    }

    const ret = isArray(object) ? new Array(object.length) : {}
    for (const key in object) {
        ret[key] = toRef(object, key);
    }
    console.log(print(filename, 'toRefs'), ret);
    return ret
}

export type MaybeRef<T = any> = T | Ref<T>
export type MaybeRefOrGetter<T = any> = MaybeRef<T> | (() => T)