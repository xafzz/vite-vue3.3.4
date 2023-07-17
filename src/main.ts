
// compiler-sfc parse() start 
// import { parse } from '@vue/compiler-sfc'
// import CompilerSFC from './compiler-sfc.vue'
// parse(CompilerSFC.template)
// compiler-sfc parse() end 



import { ref, reactive, shallowReactive, readonly, shallowReadonly, isReactive, effect } from "@vue/reactivity"


// const value = reactive({
//     a: 1,
//     b: 2
// })
// effect(() => {
//     console.log(11111, value.a);
//     effect(() => {
//         console.log(22222, value.b)
//     })
// })
// value.a++
// value.b++


const value = reactive([
    1,
    [
        2
    ]
])
effect(() => {
    console.log(11111, value);
    effect(() => {
        console.log(22222, value)
    })
})
value.push(3)
value[1].push(4)
// const value = reactive([1])
// effect(() => { 
//         console.log(654625,value.length);
//     }) 
// value.push(301)

// value.length = 3

// console.log(value.length);
