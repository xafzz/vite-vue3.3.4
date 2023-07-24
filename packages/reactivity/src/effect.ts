import { extend, isArray, isIntegerKey, isMap, print } from "@vue/shared";
import { Dep, createDep, finalizeDepMarkers, initDepMakers, newTracked, wasTracked } from "./dep";
import { EffectScope, recordEffectScope } from "./effectScope";
import { TrackOpTypes, TriggerOpTypes } from "./operations";
import { ComputedRefImpl } from "./computed";

const filename = 'reativity/effect.ts'

//存储｛target->key->dep｝连接的主要WeakMap。
//从概念上讲，更容易将依赖项视为Dep类
//它维护一组订阅者，但我们只是将它们存储为
//raw设置以减少内存开销。
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

// 当前正在递归追踪的数
let effectTrackDepth = 0
//
export let trackOpBit = 1
// 逐位跟踪标记最多支持30个级别的递归
// 选择此值是为了使现代JS引擎能够在所有平台上使用SMI。
// 当递归深度较大时，返回使用完全清理
const maxMarkerBits = 30

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
    effect: ReactiveEffect
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
    target: object
    type: TrackOpTypes | TriggerOpTypes
    key: any
    newValue?: any
    oldValue?: any
    oldTarget?: Map<any, any> | Set<any>
}

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')
// activeEffect : 标记当前活跃的effect
export let activeEffect: ReactiveEffect | undefined

// 把用户传进来的逻辑封装起来，在 响应式数据更新时 去调用
export class ReactiveEffect<T = any>{

    // 当前是否激活 false 不收集
    active = true
    // 记录当前ReactiveEffect对象在哪里被收集过
    // 属性收集的依赖会使用一个set集合存储，deps这个属性就是用来存储包含当前ReactiveEffect对象的集合的地址
    // 清除依赖的时候会将当前的ReactiveEffect对象从deps里面的所有集合中删除
    deps: Dep[] = []
    // 记录嵌套的effect中的上一级
    parent: ReactiveEffect | undefined = undefined

    computed?: ComputedRefImpl<T> // ComputedRefImpl<T>

    allowRecurse?: boolean

    private deferStop?: boolean

    onStop?: () => void
    // dev
    onTrack?: (event: DebuggerEvent) => void
    // dev
    onTrigger?: (event: DebuggerEvent) => void


    constructor(
        // 调用的时候会收集依赖（为了解决函数中的分支问题，收集依赖之前会做一次清理操作，把之前收集的依赖先清理掉）
        // 用户创建实例的时候传进来的函数
        public fn: () => T,
        // （响应式数据更新时）去调用，如果没传这个参数会调用fn
        // 用户创建实例的时候传进来的调度函数
        public scheduler: EffectScheduler | null = null,
        scope?: EffectScope
    ) {
        recordEffectScope(this, scope)
    }

    // 执行用户传进来的fn
    run() {
        // 未激活的不收集依赖
        if (!this.active) {
            return this.fn()
        }
        // 第一次是 undefined 嵌套记录上一级
        let parent: ReactiveEffect | undefined = activeEffect
        // 最后一次是是否允许跟踪
        let lastShouldTrack = shouldTrack

        // 解决嵌套
        // effect(() => effect(() => {
        //     console.log(12, value.a);
        // }))
        while (parent) {
            if (this === parent) {
                return
            }
            parent = parent.parent
        }

        try {
            this.parent = activeEffect
            // track 生效
            activeEffect = this
            shouldTrack = true

            trackOpBit = 1 << ++effectTrackDepth

            // 活跃数量 少于 30
            if (effectTrackDepth <= maxMarkerBits) {
                initDepMakers(this)
            } else {
                cleanupEffect(this)
            }
            // 执行 fn
            return this.fn()
        } finally {
            // 用完了就回收掉
            if (effectTrackDepth <= maxMarkerBits) {
                finalizeDepMarkers(this)
            }

            // 复位
            trackOpBit = 1 << --effectTrackDepth

            activeEffect = this.parent
            shouldTrack = lastShouldTrack
            this.parent = undefined

            if (this.deferStop) {
                console.error(2132323, `this.stop`);
            }
        }
    }
}

function cleanupEffect(effect: ReactiveEffect) {
    const { deps } = effect
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect)
        }
        deps.length = 0
    }
}

export interface DebuggerOptions {
    onTrack?: (event: DebuggerEvent) => void
    onTrigger?: (event: DebuggerEvent) => void
}

export interface ReactiveEffectOptions extends DebuggerOptions {
    lazy?: boolean
    scheduler?: EffectScheduler
    scope?: EffectScope
    allowRecurse?: boolean
    onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
    (): T
    effect: ReactiveEffect
}

// 创建一个ReactiveEffect 实例
// 执行ReactiveEffect 实例的 run 方法
export function effect<T = any>(
    fn: () => T, //用户传进来的立即执行函数
    options?: ReactiveEffectOptions  // 包含scheduler属性 调度函数
): ReactiveEffectRunner {

    if ((fn as ReactiveEffectRunner).effect) {
        console.error(`fn not effect`);
    }

    const _effect = new ReactiveEffect(fn)
    if (options) {
        extend(_effect, options)
        if (options.scope) recordEffectScope(_effect, options.scope)
    }
    // 如果是 lazy 不执行 run 方法
    if (!options || !options.lazy) {
        _effect.run()
    }

    const runer = _effect.run.bind(_effect) as ReactiveEffectRunner
    runer.effect = _effect
    console.log(print(filename, 'effect',));
    return runer
}

// 用做暂停和恢复捕获依赖的标志 是否应该追踪 默认true 
export let shouldTrack = true
const trackStack: boolean[] = []

// 暂停追踪
export function pauseTracking() {
    trackStack.push(shouldTrack)
    shouldTrack = false
}

export function enableTracking() {
    trackStack.push(shouldTrack)
    shouldTrack = true
}

export function resetTracking() {
    const last = trackStack.pop()
    shouldTrack = last === undefined ? true : last
}
/**
 * 跟踪对被动属性的访问。
 *
 * 这将检查当前正在运行的效果，并将其记录为dep
 * 其记录了取决于反应性质的所有影响。
 *
 * @param target-具有反应属性的对象。
 * @param type-定义对反应属性的访问类型。
 * @param key-要跟踪的反应属性的标识符。
*/
// 收集依赖
export function track(target, type, key) {
    // 可以被追踪 并且 活跃的
    if (shouldTrack && activeEffect) {
        // 初始化进来应该都没有
        let depsMap = targetMap.get(target)
        if (!depsMap) {
            // 设置map结构
            targetMap.set(target, (depsMap = new Map()))
        }
        // 初始化进来应该都没有
        let dep = depsMap.get(key)
        // 没有属性
        if (!dep) {
            depsMap.set(key, (dep = createDep()))
        }

        const eventInfo = __DEV__
            ? { effect: activeEffect, target, type, key }
            : undefined

        console.log(print(filename, 'track', `创建dep`), dep);
        trackEffects(dep, eventInfo)
    }
}

export function trackEffects(
    dep: Dep,
    debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {

    let shouldTrack = false
    if (effectTrackDepth <= maxMarkerBits) {
        if (!newTracked(dep)) {
            dep.n |= trackOpBit
            shouldTrack = !wasTracked(dep)
        }
    } else {
        shouldTrack = !dep.has(activeEffect)
    }

    if (shouldTrack) {
        // 后续computed 还要用到
        // 收集依赖
        dep.add(activeEffect!)
        console.log(print(filename, 'trackEffects',`activeEffect添加到dep中，完成收集依赖`),dep,activeEffect);
        activeEffect!.deps.push(dep)
        if (__DEV__ && activeEffect!.onTrack) {
            activeEffect!.onTrack(
                extend(
                    {
                        effect: activeEffect!
                    },
                    debuggerEventExtraInfo!
                )
            )
        }
    }
}

/**
 * 查找与目标（或特定属性）关联的所有dep
 * 触发存储在其中的效果
 * 
 * @param target-反应对象
 * @param type-定义需要触发效果的操作的类型
 * @param key-可用于针对目标对象中的特定反应属性
 */
export function trigger(
    target: object,
    type,
    key?: unknown,
    newValue?: unknown,
    oldValue?: unknown,
    oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
    const depsMap = targetMap.get(target)

    // 从未被跟踪
    if (!depsMap) {
        return
    }

    let deps: (Dep | undefined)[] = []
    if (type === TriggerOpTypes.CLEAR) {
        // 正在清除集合
        //触发目标的所有效果
        deps = [...depsMap.values()]
    } else if (key === 'length' && isArray(target)) {
        // value = reactive([1])
        // value.push(2)
        // value.length = 3
        const newLength = Number(newValue)
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= newLength) {
                deps.push(dep)
            }
        })
    } else {
        // schedule runs for SET | ADD | DELETE
        // void 运算符对给定的表达式进行求值，然后返回undefined
        if (key !== void 0) {
            deps.push(depsMap.get(key))
        }

        // 增 删 改
        switch (type) {
            case TriggerOpTypes.ADD:
                if (!isArray(target)) {
                    deps.push(depsMap.get(ITERATE_KEY))
                    if (isMap(target)) {
                        deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
                    }
                } else if (isIntegerKey(key)) {
                    // new index added to array -> length changes
                    deps.push(depsMap.get('length'))
                }
                break
            case TriggerOpTypes.DELETE:
                if (!isArray(target)) {
                    deps.push(depsMap.get(ITERATE_KEY))
                    if (isMap(target)) {
                        deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
                    }
                }
                break
            case TriggerOpTypes.SET:
                if (isMap(target)) {
                    deps.push(depsMap.get(ITERATE_KEY))
                }
                break
        }

        const eventInfo = __DEV__
            ? { target, type, key, newValue, oldValue, oldTarget }
            : undefined

        if (deps.length === 1) {
            if (deps[0]) {
                if (__DEV__) {
                    triggerEffects(deps[0], eventInfo)
                } else {
                    triggerEffects(deps[0])
                }
                console.log(print(filename, `trigger触发依赖,length:${deps.length}`, `通过${type}获取的key：'${key}',`), deps);
            }
        } else {
            const effects: ReactiveEffect[] = []
            for (const dep of deps) {
                if (dep) {
                    effects.push(...dep)
                }
            }
            if (__DEV__) {
                triggerEffects(createDep(effects), eventInfo)
            } else {
                triggerEffects(createDep(effects))
            }
            console.log(print(filename, `trigger触发依赖,length:${deps.length}`, `通过${type}获取的key：'${key}'`), createDep(effects));
        }

    }
}

export function triggerEffects(
    dep: Dep | ReactiveEffect[],
    debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
    const effects = isArray(dep) ? dep : [...dep]
    // for (const effect of effects) {
    //     if (effect.computed) {
    //         console.error(`effect.computed 存在了`);
    //         triggerEffect(effect, debuggerEventExtraInfo)
    //     }
    // }
    // for (const effect of effects) {
    //     if (!effect.computed) {
    //         triggerEffect(effect, debuggerEventExtraInfo)
    //     }
    // }
    for (const effect of effects) {
        triggerEffect(effect,debuggerEventExtraInfo)
    }
}

function triggerEffect(
    effect: ReactiveEffect,
    debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
    if (effect !== activeEffect || effect.allowRecurse) {
        if (__DEV__ && effect.onTrigger) {
            effect.onTrigger(extend({ effect }, debuggerEventExtraInfo))
        }

        if (effect.scheduler) {
            effect.scheduler()
        } else {
            effect.run()
        }
    }
}

// toRef get dep
export function getDepFromReactive(object,key) { 
    return targetMap.get(object)?.get(key)
}