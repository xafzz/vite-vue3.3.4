import { print } from "@vue/shared";

export {
    ref,
    shallowRef,
    isRef,
    unref,
    toRef,
    toRefs
} from './ref'

export {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,

    isReactive,
} from './reactive'

export { effect } from './effect'

export { computed } from './computed'

const filename = 'reativity/index.ts'

console.log(print(filename, 'start'));


