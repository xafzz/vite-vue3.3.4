import { NOOP, isFunction, print } from "@vue/shared";
import { DebuggerOptions, ReactiveEffect } from "./effect";
import { Ref, trackRefValue, triggerRefValue } from "./ref";
import { Dep } from "./dep";
import { ReactiveFlags, toRaw } from "./reactive";


const filename = 'reativity/index.ts'

declare const ComputedRefSymbol: unique symbol

export interface ComputedRef<T = any> extends WritableComputedRef<T> {
    readonly value: T
    [ComputedRefSymbol]: true
}

export interface WritableComputedRef<T> extends Ref<T> {
    readonly effect: ReactiveEffect<T>
}

export type ComputedGetter<T> = (...args: any[]) => T
export type ComputedSetter<T> = (v: T) => void

export interface WritableComputedOptions<T> {
    get: ComputedGetter<T>
    set: ComputedSetter<T>
}

export function computed<T>(
    getter: ComputedGetter<T>,
    debugOptions?: DebuggerOptions
): ComputedRef<T>
export function computed<T>(
    options: WritableComputedOptions<T>,
    debugOptions?: DebuggerOptions
): WritableComputedRef<T>
export function computed<T>(
    getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
    debugOptions?: DebuggerOptions,
    isSSR = false
) {
    let getter: ComputedGetter<T>
    let setter: ComputedSetter<T>

    // 第一个参数是不是一个函数
    const onltGetter = isFunction(getterOrOptions)
    if (onltGetter) {
        getter = getterOrOptions
        setter = __DEV__
            ? () => {
                console.warn('computed的值是只读的');
            }
            : NOOP
    } else {
        getter = getterOrOptions.get
        setter = getterOrOptions.set
    }

    const CRef = new ComputedRefImpl(getter, setter, onltGetter || !setter, isSSR)

    if (__DEV__ && debugOptions && !isSSR) {
        CRef.effect.onTrack = debugOptions.onTrack
        CRef.effect.onTrigger = debugOptions.onTrigger
    }
    console.log(print(filename, 'computed'), CRef);
    return CRef as any
}

export class ComputedRefImpl<T> {

    public dep?: Dep = undefined

    private _value!: T
    public readonly effect: ReactiveEffect<T>

    public readonly __v_isRef = true // 返回是一个ref
    public readonly [ReactiveFlags.IS_READONLY]: boolean = false

    public _dirty = true
    public _cacheable: boolean

    constructor(
        getter: ComputedGetter<T>,
        private readonly _setter: ComputedSetter<T>,
        isReadonly: boolean,
        isSSR: boolean
    ) {

        this.effect = new ReactiveEffect(getter, () => {
            if (!this._dirty) {
                this._dirty = true
                triggerRefValue(this)
            }
        })
        this.effect.computed = this
        // 默认 isSSR false，激活 收集依赖
        this.effect.active = this._cacheable = !isSSR
        this[ReactiveFlags.IS_READONLY] = isReadonly
    }

    get value() {
        // 计算的ref可能被其他代理封装，例如readonly（）#3376
        const self = toRaw(this)
        trackRefValue(self)
        if (self._dirty || !self._cacheable) {
            self._dirty = false
            // 执行 传进来的 fn
            self._value = self.effect.run()!
        }
        return self._value
    }
    set value(newValue: T) {
        this._setter(newValue)
    }
}