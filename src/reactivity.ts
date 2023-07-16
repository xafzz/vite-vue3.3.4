import { ref, reactive,shallowReactive,readonly,shallowReadonly } from "@vue/reactivity"


let value = undefined

value = reactive({
    a: 1,
    b: 2,
    c: {
        d: 3,
        e: {
            f: 4
        }
    }
})

value.a = 2

export {
    value
}