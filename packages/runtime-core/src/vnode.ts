import { PatchFlags, ShapeFlags, extend, isArray, isFunction, isObject, isString, print } from "@vue/shared"
import { currentRenderingInstance, currentScopeId } from "./componentRenderContext";
import { NULL_DYNAMIC_COMPONENT } from "./helpers/resolveAssets";
import { isClassComponent } from "./components";
import { ReactiveFlags, isProxy, isRef, toRaw } from "@vue/reactivity";
import { isSuspense } from "./components/Suspense";
import { isTeleport } from "./components/Teleport";
import { AppContext } from "./apiCreateApp";

const filename = 'runtime-core/vnode.ts'

export const Text = Symbol.for('v-txt')
export const Comment = Symbol.for('v-cmt')
export const Static = Symbol.for('v-stc')

export const Fragment = Symbol.for('v-fgt') as any as {
    __isFragment: true
    new(): {
        $props: VNodeProps
    }
}

export interface VNode<
    HostNode,
    HostElement,
    ExtraProps = { [key: string]: any }
> {
    /**
     * @internal
     */
    __v_isVNode: true

    /**
     * @internal
     */
    [ReactiveFlags.SKIP]: true

    type: any
    props: (VNodeProps & ExtraProps) | null
    key: string | number | symbol | null
    ref: null
    /**
     * SFC only. This is assigned on vnode creation using currentScopeId
     * which is set alongside currentRenderingInstance.
     */
    scopeId: string | null
    /**
     * SFC only. This is assigned to:
     * - Slot fragment vnodes with :slotted SFC styles.
     * - Component vnodes (during patch/hydration) so that its root node can
     *   inherit the component's slotScopeIds
     * @internal
     */
    slotScopeIds: string[] | null
    children: any
    component: null
    dirs: null
    transition: null

    // DOM
    el: HostNode | null
    anchor: HostNode | null // fragment anchor
    target: HostElement | null // teleport target
    targetAnchor: HostNode | null // teleport target anchor
    /**
     * number of elements contained in a static vnode
     * @internal
     */
    staticCount: number

    // suspense
    suspense: null
    /**
     * @internal
     */
    ssContent: null
    /**
     * @internal
     */
    ssFallback: null

    // optimization only
    shapeFlag: number
    patchFlag: number
    /**
     * @internal
     */
    dynamicProps: string[] | null
    /**
     * @internal
     */
    dynamicChildren: null

    // application root node only
    appContext: AppContext | null

    /**
     * @internal lexical scope owner instance
     */
    ctx: null

    /**
     * @internal attached by v-memo
     */
    memo?: any[]
    /**
     * @internal __COMPAT__ only
     */
    isCompatRoot?: true
    /**
     * @internal custom element interception hook
     */
    ce?: (instance) => void
}

// https://github.com/microsoft/TypeScript/issues/33099
export type VNodeProps = {
    key?: string | number | symbol
    ref?: any //VNodeRef
    ref_for?: boolean
    ref_key?: string

    // vnode hooks
    onVnodeBeforeMount?: any // VNodeMountHook | VNodeMountHook[]
    onVnodeMounted?: any //VNodeMountHook | VNodeMountHook[]
    onVnodeBeforeUpdate?: any //VNodeUpdateHook | VNodeUpdateHook[]
    onVnodeUpdated?: any //VNodeUpdateHook | VNodeUpdateHook[]
    onVnodeBeforeUnmount?: any //VNodeMountHook | VNodeMountHook[]
    onVnodeUnmounted?: any //VNodeMountHook | VNodeMountHook[]
}

let vnodeArgsTransformer:
    | ((
        args: Parameters<typeof _createVNode>,
        instance: null
    ) => Parameters<typeof _createVNode>)
    | undefined

const createVNodeWithArgsTransform = (
    ...args: Parameters<typeof _createVNode>
) => {
    if (vnodeArgsTransformer) {
        console.error(vnodeArgsTransformer);
    }
    return _createVNode(
        ...(vnodeArgsTransformer
            ? vnodeArgsTransformer(args, currentRenderingInstance)
            : args)
    )
}

export const createVNode = __DEV__ ? createVNodeWithArgsTransform : _createVNode

/**
 * 创建组件的虚拟节点
 * 主要是对传递的type做出判断,通过赋值shapeFlag来标明当前的虚拟节点的类型
 * 
 * @param type .vue文件编译形成的对象
 * @param props 组件传递的props
 * @param children 子组件
 * @param patchFlag patch的类型
 * @param dynamicProps 动态的props
 * @param isBlockNode 是否是block节点
 */
function _createVNode(
    type,
    props,
    children: unknown = null,
    patchFlag: number = 0,
    dynamicProps: string[] | null = null,
    isBlockNode = false
) {

    // 不存在 或者 空的动态组件
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
        if (__DEV__ && !type) {
            console.warn(`创建vnode时类型无效${type}`)
        }
        type = Comment
    }

    // <component :is="vnode"/>
    // __v_isVNode
    if (isVNode(type)) {
        console.error(`isVNode(type)`, type);
    }

    // __vccOpts判断是否是class组件
    if (isClassComponent(type)) {
        console.error(`isClassComponent(type)`);
    }

    // 兼容 v2
    if (__COMPAT__) { }

    /**
     * 初始加载时：
     * const app = createApp(App, {
     *    name: 'ddd'
     * })
     * 
     * props：{ name: 'ddd' }
     */
    if (props) {
        console.log(``, 2222, props);
        //对于代理过的对象,我们需要克隆来使用他们
        //因为直接修改会导致触发响应式
        props = guardReactiveProps(props)!
        let { class: klass, style } = props
        if (klass && !isString(klass)) {
            // :class={hello:true,world:false} => :class="hello"
            console.error(`klass`, klass);
        }
        if (isObject(style)) {
            // <div :style="['background:red',{color:'red'}]"></div>  转为
            // <div style={color:'red',background:'red'}></div>
            console.error(`style`, style);
        }
    }

    // 生成 type 类型 默认是element
    let shapeFlag = 1
    if (isString(type)) {
        //div span p等是ELEMENT
        shapeFlag = ShapeFlags.ELEMENT;
    } else if (isSuspense(type)) {    // vue 内部实现的组件，自带属性 __isSuspense
        shapeFlag = ShapeFlags.SUSPENSE;
    } else if (isTeleport(type)) { // vue 内部实现的组件，自带属性 __isTeleport
        shapeFlag = ShapeFlags.TELEPORT;
    } else if (isObject(type)) {
        //对象则是有状态组件
        shapeFlag = ShapeFlags.STATEFUL_COMPONENT;
    } else if (isFunction(type)) {
        //如果是函数代表是无状态组件
        shapeFlag = ShapeFlags.FUNCTIONAL_COMPONENT;
    }

    // 不要使用响应式对象当作组件
    if (__DEV__ && shapeFlag & ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
        type = toRaw(type)
        console.warn(
            `如果是一个响应式对象会导致不必要的开销，应通过'shallowRef'或'markRaw'`,
            type
        )
    }

    const result = createBaseVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        shapeFlag,
        isBlockNode,
        true
    )
    console.log(print(filename, '_createVNode',`createBaseVNode as createElementVNode 创建：`), result)
    return result
}

export function isVNode(value: any) {
    return value ? value.__v_isVNode === true : false
}

export const InternalObjectKey = `__vInternal`

export function guardReactiveProps(props) {
    if (!props) return null
    return isProxy(props) || InternalObjectKey in props
        ? extend({}, props)
        : props
}


const normalizeKey = ({ key }: VNodeProps) => key != null ? key : null

// 用于标准化props中的ref属性
const normalizeRef = ({
    ref,
    ref_key,
    ref_for
}: VNodeProps) => {
    if (typeof ref === 'number') {
        ref = '' + ref
    }
    return (
        ref != null
            ? isString(ref) || isRef(ref) || isFunction(ref)
                ? { i: currentRenderingInstance, r: ref, k: ref_key, f: !!ref_for }
                : ref
            : null
    ) as any
}

// 我们是否应该跟踪块内的动态子节点。
// 仅在该值大于 0 时进行跟踪
// 我们不使用简单的布尔值，因为 v-once 的嵌套使用可能需要
// 通过嵌套使用 v-once 来递增/递减（见下文）
export let isBlockTreeEnabled = 1

// 由于 v-if 和 v-for 是节点结构动态变化的两种可能方式。
// 一旦我们将 v-if 分支和每个 v-for 片段视为一个块，我们就可以将模板划分为嵌套块，并在每个块内将节点划分为节点块。
// 我们就可以把一个模板分成嵌套的块，而在每个块中，节点的 结构都是稳定的。
// 这样，我们就可以跳过大多数子节点的差分，而只关心动态节点（用补丁标记表示）。
export const blockStack = []
export let currentBlock = null

// 创建组件的虚拟节点方法createVNode必须标准化children，
// needFullChildrenNormalization = true
// createElementVNode
function createBaseVNode(
    type,//创建的虚拟节点的类型
    props = null,//传递的props
    children = null,//子节点
    patchFlag = 0,//patch类型
    dynamicProps = null,//动态props
    shapeFlag = type === Fragment ? 0 : 1,//当前虚拟节点的类型
    isBlockNode = false,//是否是block
    needFullChildrenNormalization = false//是否需要标准化children
) {

    const vnode = {
        __v_isVNode: true, //这是一个vnode
        __v_skip: true, //不进行响应式代理
        type, //.vue文件编译后的对象
        props, //组件收到的props
        key: props && normalizeKey(props), //组件key
        ref: props && normalizeRef(props), //收集到的ref
        scopeId: currentScopeId,//当前作用域ID
        slotScopeIds: null, //插槽ID
        children, //child组件
        component: null, //组件实例
        suspense: null,//存放suspense
        ssContent: null,//存放suspense的default的虚拟节点
        ssFallback: null,//存放suspense的fallback的虚拟节点
        dirs: null, //解析到的自定义指令
        transition: null,
        el: null, //对应的真实DOM
        anchor: null, //插入的锚点
        target: null,//teleport的参数to指定的DOM
        targetAnchor: null,//teleport插入的锚点
        staticCount: 0, // 静态节点数量
        shapeFlag, //表示当前vNode的类型
        patchFlag, //path的模式
        dynamicProps, //含有动态的props
        dynamicChildren: null, //含有的动态children
        appContext: null, //app上下文
        ctx: currentRenderingInstance
    };
    console.error(`${type as any}--->`, vnode)

    //是否需要对children进行标准化
    // 初始化 children = null
    if (needFullChildrenNormalization) {
        // children 根 type 重新赋值
        normalizeChildren(vnode, children);
        //处理SUSPENSE逻辑
        if (shapeFlag & ShapeFlags.SUSPENSE) {
            console.error(`shapeFlag & ShapeFlags.SUSPENSE`);
            //赋值ssContent=>default和ssFallback=>fallback
            // type.normalize(vnode);
        }
    }
    // 有子节点
    // _createElementVNode("p", { class: "hoist" }, "静态到哦", -1 /* HOISTED */)
    // _createElementVNode("div", null, "ddd", -1 /* HOISTED */)
    else if (children) {
        // 字符串/数组
        vnode.shapeFlag |= isString(children)
            ? ShapeFlags.TEXT_CHILDREN
            : ShapeFlags.ARRAY_CHILDREN
    }

    // validate key
    if (__DEV__ && vnode.key !== vnode.key) {
        console.warn(`用无效密钥（NaN）创建的 VNode :`, vnode.type)
    }

    // 是否加入dynamicChildren
    if (
        isBlockTreeEnabled > 0 && // 大于0 允许被跟踪
        !isBlockNode && //当前不是block
        currentBlock && // 当前父级
        // 补丁标记的存在表明该节点需要在更新时打补丁。
        // 组件节点也应经常打补丁，因为组件不需要更新，
        //它也需要将实例持久化到下一个 vnode，以便以后可以正确卸载。
        (vnode.patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
        // EVENTS ssr
        // 由于缓存处理程序的原因，vnode 不应被视为动态节点。
        vnode.patchFlag !== PatchFlags.HYDRATE_EVENTS
    ) {
        console.error(``, 1);
        currentBlock.push(vnode)
    }

    // 不兼容
    if (__COMPAT__) { }

    console.log(print(filename, 'createBaseVNode|createElementVNode', `创建 '${type}' vnode对象`), vnode)
    return vnode
}

export { createBaseVNode as createElementVNode }

// 标准化虚拟节点的children属性，主要是对slots属性的处理
export function normalizeChildren(vnode, children) {
    //设置shapeFlag的初始值
    let type = 0
    const { shapeFlag } = vnode
    if (children == null) {
        children = null
    } else if (isArray(children)) {
        type = ShapeFlags.ARRAY_CHILDREN
    }
    //处理"<Comp>插槽内容</Comp>"这种情况
    //如果你一定要自己写render函数官方推荐
    //对象形式,并返回一个函数的类型
    //createVNode(Comp,null.{default:()=>Vnode})
    else if (typeof children === 'object') {
        console.error(print(filename, 'typeof children === object'))
    }
    //重新包装children
    else if (isFunction(children)) {
        console.error(print(filename, 'isFunction(children)'))
    } else {
        console.error(print(filename, 'else children'))
    }
    vnode.children = children
    vnode.shapeFlag |= type
    console.log(print(filename, 'normalizeChildren', '虚拟节点的children属性，主要是对slots属性的处理'), vnode.children, vnode.shapeFlag)
}

export function cloneVNode(vnode, extraProps = null, mergeRef = false) {

    console.error(print(filename, 'cloneVNode'), vnode)
}


export function createElementBlock() {
    console.error(print(filename, 'createElementBlock'))
}


export function openBlock() {

    console.error(print(filename, 'openBlock'))
}