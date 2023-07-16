import { print } from "@vue/shared";

const filename = 'reativity/effect.ts'


export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any>{ 

    constructor() { 
        console.log(111);
        
    }
} 
// 是否应该追踪 默认true
export let shouldTrack = true
const trackStack: boolean[] = []

// 暂停追踪
export function pauseTracking() { 
    trackStack.push(shouldTrack)
    shouldTrack = false
}

export function resetTracking() { 
    const last = trackStack.pop()
    shouldTrack = last === undefined ? true : last
}

export function track(target,type,key) { 

    console.error(print(filename, 'track','没有写'), target,type,key);
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
    oldTarget?:Map<unknown,unknown> | Set<unknown>
) { 

    console.error(print(filename, 'trigger','没有写'), target,type,key);
}