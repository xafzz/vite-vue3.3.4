# vite-vue3.3.4

手动敲一遍vue3.3.4,深入了解下源码

## isComponent 函数没有写完，组件部分

compiler-core/parse.ts

## parseTag 组件部分

compiler-core/parse.ts


## [单文件组件 CSS 功能](https://cn.vuejs.org/api/sfc-css-features.html#v-bind-in-css)

parseCssVars()

### modules

```
<template>
  <p :class="$style.red">This should be red</p>
</template>

<style module>
.red {
  color: red;
}
</style>
```


### `v-bind()`

```
<script setup>
const theme = {
  color: 'red'
}
</script>

<template>
  <p>hello</p>
</template>

<style scoped>
p {
  color: v-bind('theme.color');
}
</style>
```