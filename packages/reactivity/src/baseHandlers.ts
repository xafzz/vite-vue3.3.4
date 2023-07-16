import { extend, hasChanged, hasOwn, isArray, isIntegerKey, isObject, isSymbol, print, makeMap } from "@vue/shared"
import { ReactiveFlags, isReadonly, isShallow, reactive, reactiveMap, readonly, readonlyMap, shallowReactiveMap, shallowReadonlyMap, toRaw } from "./reactive"
import { ITERATE_KEY, pauseTracking, resetTracking, track, trigger } from "./effect"
import { TrackOpTypes, TriggerOpTypes } from "./operations"
import { isRef } from "./ref"

const filename = 'reativity/baseHandlers.ts'


const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
    /*#__PURE__*/
    Object.getOwnPropertyNames(Symbol)
        // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
        // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
        // function
        .filter(key => key !== 'arguments' && key !== 'caller')
        .map(key => (Symbol as any)[key])
        .filter(isSymbol)
)

const get = /*#__PURE__*/ createGetter()
const shallowGet = /*#__PURE__*/ createGetter(false, true)
const readonlyGet = /*#__PURE__*/ createGetter(true, false)
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true)

const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations()

function createArrayInstrumentations() {
    const instrumentations: Record<string, Function> = {}

        ; (['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
            instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
                const arr = toRaw(this) as any
                for (let i = 0, l = this.length; i < l; i++) {
                    // 每个索引都需要进行收集依赖
                    track(arr, TrackOpTypes.GET, i + '')
                }
                // 首先使用原始args运行该方法（可能是被动的）
                const res = arr[key](...args)
                if (res === -1 || res === false) {
                    // 如果不起作用，请使用原始值再次运行它。
                    return arr[key](...args.map(toRaw))
                } else {
                    return res
                }
            }
        })

        ; (['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
            instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
                // 暂停依赖收集
                // 因为push等操作是修改数组的，所以在push过程中不进行依赖的收集是合理的，只要它能够触发依赖就可以
                console.log(`----->push：${this}、${args}、${key}`)
                pauseTracking()
                console.log(`----->push start`, this, args)
                // const res = (toRaw(this) as any)[key].apply(this, args)
                const res = (toRaw(this) as any)[key].apply(this, args)
                console.log(`----->push end`)
                resetTracking()
                return res
            }
        })
    console.log(print(filename, 'createArrayInstrumentations',), instrumentations);
    return instrumentations
}
function hasOwnProperty(this, key) {
    const obj = toRaw(this)
    track(obj, TrackOpTypes.HAS, key)
    return obj.hasOwnProperty(key)

}

// get捕获器为属性读取操作的捕获器，
// 它可以捕获obj.pro、array[index]、array.indexOf()、arr.length、Reflect.get()、Object.create(obj).foo（访问继承者的属性）等操作
function createGetter(
    isReadonly = false, // 是否只读的响应式数据
    shallow = false // 是否是浅层响应式数据
) {
    return function get(target, key, receiver) {
        if (key === ReactiveFlags.IS_REACTIVE) {  // __v_isReactive  是不是reactive
            return !isReadonly
        } else if (key === ReactiveFlags.IS_READONLY) { // __v_isReadonly 是不是只读
            return isReadonly
        } else if (key === ReactiveFlags.IS_SHALLOW) {  // __v_isShallow 是不是浅层响应式
            return shallow
        } else if (

            // 为了避免从原型链上获取不属于自己的原始对象
            /** 例
             *  const parent = { p:1 }

                const parentReactive = reactive(parent)
                const child = Object.create(parentReactive)

                console.log(toRaw(parentReactive) === parent) // true
                console.log(toRaw(child) === parent) // false
             */
            key === ReactiveFlags.RAW && // __v_raw 是不是原始值
            receiver === (isReadonly
                ? shallow
                    ? shallowReadonlyMap
                    : readonlyMap
                : shallow
                    ? shallowReactiveMap
                    : reactiveMap
            ).get(target) // receiver全等于target的代理对象
        ) {
            return target
        }


        const targetIsArray = isArray(target)

        // reactive shallowReactive
        if (!isReadonly) {
            // 如果是数组 需要对 includes indexOf lastIndexOf push pop shift unshift splice 特殊处理
            // 对于 push pop shift unshift splice
            // 写入或删除时 底层会获取当前数组的length 属性 如果在effect使用
            // 会收集length属性的依赖 当使用这些api 时 也会更改length ，会造成死循环
            if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
                return Reflect.get(arrayInstrumentations, key, receiver)
            }
            // xx.hasOwnProperty
            if (key === 'hasOwnProperty') {
                // 返回 hasOwnProperty 方法
                return hasOwnProperty
            }
        }

        const res = Reflect.get(target, key, receiver)

        if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
            return res
        }

        // 不是只读 才会收集依赖
        // 只读数据无法进行修改 收集依赖也是没用的
        if (!isReadonly) {
            console.log(32123, target, TrackOpTypes.GET, key)
            // track(target, TrackOpTypes.GET, key)
        }

        if (shallow) {
            return res
        }

        // 如果res是ref，target不是数组的情况下，会自动解包。
        if (isRef(res)) {
            return targetIsArray && isIntegerKey(key) ? res : res.value
        }

        // 如果res是Object，进行深层响应式处理。
        // Proxy是懒惰式的创建响应式对象，只有访问对应的key，才会继续创建响应式对象，否则不用创建。
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res)
        }
        console.log(print(filename, 'createGetter',), `key:${key}`, res);
        return res

    }
}

const set = /*#__PURE__*/ createSetter()
const shallowSet = /*#__PURE__*/ createSetter(true)

function createSetter(shallow = false) {
    return function set(
        target: object,
        key: string | symbol,
        value: unknown,
        receiver: object
    ) {
        // 获取旧值
        let oldValue = (target as any)[key]
        // 只读的 ref，新的值不是ref 返回false 不能修改
        if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
            return false
        }
        // 不是浅层响应式 并且新的值不是readonly
        if (!shallow) {
            // 新值不是浅层响应式 新、旧值取对应的原始值
            if (!isShallow(value) && !isReadonly(value)) {
                oldValue = toRaw(oldValue)
                value = toRaw(value)
            }
            // 如果target 不是数组并且旧值是ref类型
            // 新值不是ref类型 直接修改 
            if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                oldValue.value = value
                return true
            }
        } else {
            // 如果是浅层响应式，对象按原样设置
            // 本身就是惰性的 只有用到才会proxy 代理
        }

        // key 不是 target 本身
        const hadKey = isArray(target) && isIntegerKey(key)
            ? Number(key) < target.length
            : hasOwn(target, key)

        const result = Reflect.set(target, key, value, receiver)

        // 对于处在原型链上的target不触发依赖
        if (target === toRaw(receiver)) {
            // 触发依赖，根据hadKey值决定是新增属性还是修改属性
            if (!hadKey) {
                trigger(target, TriggerOpTypes.ADD, key, value)
            } else if (hasChanged(value, oldValue)) {
                // 如果是修改操作，比较新旧值
                trigger(target, TriggerOpTypes.SET, key, value, oldValue)
            }
        }

        console.log(print(filename, 'createSetter'), result);
        return result
    }
}


function deleteProperty(target, key) {

    console.error('deleteProperty()');
}

function has(target, key) {

    console.error('has()');
}

function ownKeys(target) {
    console.error('ownKeys()');
}

export const mutableHandlers = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
}

export const shallowReactiveHandlers =  /*#__PURE__*/ extend(
    {},
    mutableHandlers,
    {
        get: shallowGet,
        set: shallowSet
    }
)

export const readonlyHandlers = {
    get: readonlyGet,
    set(target, key) {
        if (__DEV__) {
            console.warn(
                `Set operation on key "${String(key)}" failed: target is readonly.`,
                target
            )
        }
        return true
    },
    deleteProperty(target, key) {
        if (__DEV__) {
            console.warn(
                `Delete operation on key "${String(key)}" failed: target is readonly.`,
                target
            )
        }
        return true
    }
}

export const shallowReadonlyHandlers = /*#__PURE__*/ extend(
    {},
    readonlyHandlers,
    {
        get: shallowReadonlyGet
    }
)