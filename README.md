# Computed

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

## ComputedRefImpl

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