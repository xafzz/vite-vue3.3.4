import { print } from "@vue/shared";

export {
    ref,
    shallowRef,
    isRef,
    unref,
    toRef,
    toRefs,

    Ref,

    proxyRefs
} from './ref'

export {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,

    isReactive,
    isProxy,

    toRaw,
    ReactiveFlags,

    markRaw,
    isShallow
} from './reactive'

export {
    effect,
    track,
    pauseTracking,
    resetTracking,

    trigger
} from './effect'

export {
    EffectScope,
  } from './effectScope'

export { computed } from './computed'

export {
    TrackOpTypes /* @remove */,
    TriggerOpTypes /* @remove */
  } from './operations'

const filename = 'reativity/index.ts'

console.log(print(filename, 'start'));


