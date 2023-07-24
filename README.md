## Ref

### ReactiveEffect

```js
// 把用户传进来的逻辑封装起来，在 响应式数据更新时 去调用
class ReactiveEffect<T = any>{

    // 当前是否激活 false 不收集
    active = true
    // 记录当前ReactiveEffect对象在哪里被收集过
    // 属性收集的依赖会使用一个set集合存储，deps这个属性就是用来存储包含当前ReactiveEffect对象的集合的地址
    // 清除依赖的时候会将当前的ReactiveEffect对象从deps里面的所有集合中删除
    deps: Dep[] = []
    // 记录嵌套的effect中的上一级
    parent: ReactiveEffect | undefined = undefined

    computed?: ComputedRefImpl<T> // ComputedRefImpl<T>

    allowRecurse?: boolean

    private deferStop?: boolean

    onStop?: () => void
    // dev
    onTrack?: (event: DebuggerEvent) => void
    // dev
    onTrigger?: (event: DebuggerEvent) => void


    constructor(
        // 调用的时候会收集依赖（为了解决函数中的分支问题，收集依赖之前会做一次清理操作，把之前收集的依赖先清理掉）
        // 用户创建实例的时候传进来的函数
        public fn: () => T,
        // （响应式数据更新时）去调用，如果没传这个参数会调用fn
        // 用户创建实例的时候传进来的调度函数
        public scheduler: EffectScheduler | null = null,
        scope?: EffectScope
    ) {
        recordEffectScope(this, scope)
    }

    // 执行用户传进来的fn
    run() {
        // 未激活的不收集依赖
        if (!this.active) {
            return this.fn()
        }
        // 第一次是 undefined 嵌套记录上一级
        let parent: ReactiveEffect | undefined = activeEffect
        // 最后一次是是否允许跟踪
        let lastShouldTrack = shouldTrack

        // 解决嵌套
        // effect(() => effect(() => {
        //     console.log(12, value.a);
        // }))
        while (parent) {
            if (this === parent) {
                return
            }
            parent = parent.parent
        }

        try {
            this.parent = activeEffect
            // track 生效
            activeEffect = this
            shouldTrack = true

            trackOpBit = 1 << ++effectTrackDepth

            // 活跃数量 少于 30
            if (effectTrackDepth <= maxMarkerBits) {
                initDepMakers(this)
            } else {
                cleanupEffect(this)
            }
            // 执行 fn
            return this.fn()
        } finally {
            // 用完了就回收掉
            if (effectTrackDepth <= maxMarkerBits) {
                finalizeDepMarkers(this)
            }

            // 复位
            trackOpBit = 1 << --effectTrackDepth

            activeEffect = this.parent
            shouldTrack = lastShouldTrack
            this.parent = undefined

        }
    }
}
```

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

## Computed

```js
const val = computed(xx)

// const CRef = new ComputedRefImpl(getter, setter, onltGetter || !setter, isSSR)
```

### isFunction(xx) = true

```js
     const count = ref(1)
     const changeCount = computed(() =>  count.value ++ )

     // readonly 不能设置
     // changeCount.value = 2222

     getter = getterOrOptions // () =>  count.value ++
     setter = __DEV__
          ? () => {
               console.warn('computed的值是只读的');
          }
          : NOOP
```

### isFunction(xx) = false

```js
     const count = ref(1)
     const plusOne = computed({
     get: () => count.value + 2,
     set: val => {
          count.value = val - 1
          }
     })

     getter = getterOrOptions.get
     setter = getterOrOptions.set
```

### ComputedRefImpl

```js
class ComputedRefImpl<T> {

    public dep?: Dep = undefined

    private _value!: T
    public readonly effect: ReactiveEffect<T>

    public readonly __v_isRef = true // 返回是一个ref
    public readonly [ReactiveFlags.IS_READONLY]: boolean = false

    public _dirty = true
    public _cacheable: boolean

    constructor(
        getter: ComputedGetter<T>,
        private readonly _setter: ComputedSetter<T>,
        isReadonly: boolean,
        isSSR: boolean
    ) {

        this.effect = new ReactiveEffect(getter, () => {
            if (!this._dirty) {
                this._dirty = true
                triggerRefValue(this)
            }
        })
        this.effect.computed = this
        // 默认 isSSR false，激活 收集依赖
        this.effect.active = this._cacheable = !isSSR
        this[ReactiveFlags.IS_READONLY] = isReadonly
    }

    get value() {
        // 计算的ref可能被其他代理封装，例如readonly（）#3376
        const self = toRaw(this)
        trackRefValue(self)
        if (self._dirty || !self._cacheable) {
            self._dirty = false
            // 执行 传进来的 fn
            self._value = self.effect.run()!
        }
        return self._value
    }
    set value(newValue: T) {
        this._setter(newValue)
    }
}
```