
// compiler-sfc parse() start 
// import { parse } from '@vue/compiler-sfc'
// import CompilerSFC from './compiler-sfc.vue'
// parse(CompilerSFC.template)
// compiler-sfc parse() end 



import { effect, isRef, reactive, ref, shallowRef, toRef, toRefs, unref } from "@vue/reactivity"

const state = reactive({
    a:1,
    b:2,
    c:3
})

const res = {}
for(const key in state){
     res[key] = toRef(state,key)
}

console.log(res);
