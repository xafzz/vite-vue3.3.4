import { computed, ref } from "@vue/reactivity";


const count = ref(1)

// const changeCount = computed(() =>  count.value ++ )

// readonly 不能设置
// changeCount.value = 2222
// console.log(222,changeCount.value);

const plusOne = computed({
    get: () => count.value + 2,
    set: val => {
        count.value = val - 1
      }
})
plusOne.value = 10
console.log(count.value,count);
console.log(plusOne.value,plusOne);
