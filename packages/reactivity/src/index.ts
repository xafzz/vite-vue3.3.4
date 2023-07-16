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

const filename = 'reativity/index.ts'

console.log(print(filename, 'start'));


