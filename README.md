
## watch 观察选项配置

使用`chokidar` 代替 node 内置的文件监听 fs.watch 


## Ref

### ref()

```js
effect(() => { 
     console.log(`结果：${count.value}`);
})
count.value ++
```

### shallowRef()

```
const state = shallowRef({ count: 1 })

// 不会触发更改
// 只对 .value 是响应式 深层没有递归转为响应式
state.value.count = 2

// 会触发更改
state.value = { count: 2 }
```

### isRef()

```js
const count = ref(1)

console.log(isRef(count));  // true
```

### unref()

```js
const count = ref(1)

console.log(isRef(count)); // 1
```

### toRef()

- isRef(source)

  return source

- isFunction(source)
  
  return source()
   
- isObject(sourve)
  
  return isRef(source) ? source : new ObjectRefImpl{
     public readonly __v_isRef = true

     constructior(
          object,key,defaultValue
     ){}

     get value(){
          const val = this.object[this.key]
          return val === undefined ? this.defaultValue : val
     }
     set value(newVal){
          this.object[this.key] = newVal
     }
  }
  
- default

  return ref(souce)


### toRefs()

```js
const state = reactive({
     a:1,
     b:2,
     c:3
})
// ret 相当于下面的 res
const ret = toRefs(state)
// 相当于
const res = {}
for(const key in state){
     res[key] = ref(state,key)
}
```