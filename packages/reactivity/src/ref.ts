import { hasChanged, print } from "@vue/shared";
import { isReadonly, isShallow, toRaw, toReactive } from "./reactive";
import { activeEffect, shouldTrack } from "./effect";

const filename = 'reativity/ref.ts'

// 收集依赖
export function trackRefValue(ref) { 
    // shouldTrack :用做暂停和恢复捕获依赖的标志
    // activeEffect : 标记当前活跃的effect
    if (shouldTrack && activeEffect) {
        console.error(`收集了个寂寞 activeEffect undefined`);
    }
}

// 触发ref的响应式更新
export function triggerRefValue(ref, newVal) { 
    ref = toRaw(ref)
    const dep = ref.dep
    if ( dep ) { 
        console.error('没有dep?');
    }
}

export function isRef(r) {
    const result = !!(r && r.__v_isRef === true)
    console.log(print(filename, 'isRef', '通过__v_isRef'), result);
    return result
}

export function ref(value?: unknown) {
    console.log(print(filename, 'ref'), value);

    return createRef(value, false)
}

function createRef(rawValue: unknown, shallow: boolean) {
    if (isRef(rawValue)) {
        console.log(print(filename, 'createRef'), rawValue);
        return rawValue
    }

    const result = new RefImpl(rawValue, shallow)
    console.log(print(filename, 'createRef', 'new RefImpl()'), result);
    return result
}

// 
class RefImpl {

    // 存贮会变更的值、当前值
    private _value
    // 保存原始的值
    private _rawValue

    // 存储依赖
    public dep = undefined
    // 标识 是否是 ref
    public readonly __v_isRef = true

    constructor(value, public readonly __v_isShallow: boolean) {
        // toRaw 获取原始值
        this._rawValue = __v_isShallow ? value : toRaw(value)
        // 如果是 object 则走 reative
        this._value = __v_isShallow ? value : toReactive(value)
    }

    // 获取
    get value() {
        // 收集依赖
        trackRefValue(this)
        console.log(print(filename, 'RefImpl::get()', `读：${this._value}，收集依赖：`), this);
        return this._value
    }

    // 设置
    set value(newVal) {
        const useDirectValue = this.__v_isShallow || isShallow(newVal) || isReadonly(newVal)
        // shallowRef或者 新值 是浅层的或者只读的，则设置值的之前对新值解包
        newVal = useDirectValue ? newVal : toRaw(newVal)

        // 对比新值和旧值，如果有改变则触发更新
        if ( hasChanged(newVal,this._rawValue) ) { 
            this._rawValue = newVal
            this._value = useDirectValue ? newVal : toReactive(newVal)
            // 触发响应式的更新
            triggerRefValue(this,newVal)
        }
    }
}