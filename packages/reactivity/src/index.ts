import { print } from "@vue/shared";

export {
    ref
} from './ref'

export {
    reactive,
    shallowReactive,
    readonly,
    shallowReadonly,

    isReactive,
} from './reactive'

export { effect } from './effect'

const filename = 'reativity/index.ts'

console.log(print(filename, 'start'));


