import { print } from "@vue/shared";
import { ReactiveEffect, trackOpBit } from "./effect";


const filename = 'reativity/baseHandlers.ts'

// vue2 class 类
// vue3 set 集合了

export type Dep = Set<ReactiveEffect> & TrackedMarkers

/**
 * wasTracked和newTracked在多个效果级别上保持状态
 * 跟踪递归。每个级别一位用于定义依赖项
 * was/is tracked
 */
type TrackedMarkers = {
    // 已跟踪
    w: number,
    // 新跟踪
    n: number
}

export const createDep = (effects?: ReactiveEffect[]): Dep => {
    const dep = new Set<ReactiveEffect>(effects) as Dep
    dep.w = 0
    dep.n = 0
    return dep
}

export const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0

export const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0

export const initDepMakers = ({ deps }: ReactiveEffect) => {
    if (deps.length) {
        console.log(print(filename, `initDepMakers`,'deps/w进行为运算'), deps);
        for (let i = 0; i < deps.length; i++) {
            // 按位或
            deps[i].w |= trackOpBit // set was tracked
        }
    }
}


export const finalizeDepMarkers = (effect: ReactiveEffect) => {
    const { deps } = effect
    if (deps.length) {
        let ptr = 0
        for (let i = 0; i < deps.length; i++) {
          const dep = deps[i]
          if (wasTracked(dep) && !newTracked(dep)) {
            dep.delete(effect)
          } else {
            deps[ptr++] = dep
          }
          // clear bits
          dep.w &= ~trackOpBit
          dep.n &= ~trackOpBit
        }
        deps.length = ptr
        console.log(print(filename, 'finalizeDepMarkers','重置了dep.w/n'),deps);
        
    }
}