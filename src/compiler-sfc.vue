<template>
  <div>
    <p>hello</p>
  </div>
</template>

<script setup lang="ts">
const theme = {
  color: 'red',
  width: '100px'
}
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