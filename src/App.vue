<template>
  <div>
    <p>hello，{{name}}</p>
    <button @click="click">+1</button>
    <div>{{age}}</div>
    <p>{{msg}}</p>
  </div>
</template>

<script setup lang="ts">
import { toRefs,reactive } from 'vue'

const theme = {
  color: 'red',
  width: '100px'
}

const state = reactive({
  name:'我',
  age: 16,
  msg:'就是一个msg',
})

const click = () => { 
  state.age ++
}

const { name, age, msg } = toRefs(state)
</script>

<style scoped>
div{
  width: v-bind('theme.width');
}
p {
  color: v-bind('theme.color');
}

/* 插槽选择器 */
:slotted(div) {
  color: red;
}
</style>