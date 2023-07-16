
// compiler-sfc parse() start 
// import { parse } from '@vue/compiler-sfc'
// import CompilerSFC from './compiler-sfc.vue'
// parse(CompilerSFC.template)
// compiler-sfc parse() end 



import { ref, reactive,shallowReactive,readonly,shallowReadonly,isReactive } from "@vue/reactivity"

let value = undefined

value = shallowReactive([1])

value.push(30) // = 30

console.log(`结果：`,isReactive(value),value);
