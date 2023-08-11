import { NOOP, PatchFlags, ShapeFlags, getGlobalThis, isReservedProp, print } from "@vue/shared";
import { createAppAPI } from "./apiCreateApp";
import { hmrDirtyComponents, isHmrUpdating, registerHMR } from "./hmr";
import { setDevtoolsHook } from "./devtools";
import { Comment, Fragment, Static, Text, cloneIfMounted, invokeVNodeHook, normalizeVNode } from "./vnode";
import { createComponentInstance, setupComponent } from "./component";
import { pushWarningContext } from "./warning";
import { endMeasure, startMeasure } from "./profiling";
import { isKeepAlive } from "./components/KeepAlive";
import { ReactiveEffect } from "packages/reactivity/src/effect";
import { queueJob, queuePostFlushCb } from "./scheduler";
import { isAsyncWrapper } from "./apiAsyncComponent";
import { filterSingleRoot, renderComponentRoot } from "./componentRenderUtils";
import { invokeDirectiveHook } from "./directives";
import { queueEffectWithSuspense } from "./components/Suspense";


const filename = 'runtime-core/renderer.ts'


export const enum MoveType {
    ENTER,
    LEAVE,
    REORDER
}

export const queuePostRenderEffect = __FEATURE_SUSPENSE__
    ? __TEST__
        ? // vitest can't seem to handle eager circular dependency
        (fn: Function | Function[], suspense: any | null) =>
            queueEffectWithSuspense(fn, suspense)
        : queueEffectWithSuspense
    : queuePostFlushCb


//  createRenderer<Node, Element>
export function createRenderer(options) {
    return baseCreateRenderer(options)
}

// 给effect和update设置allowRecurse，值为传入的第二个参数allowed
function toggleRecurse(
    { effect, update }: any,
    allowed: boolean
) {
    // 给effect和update设置allowRecurse，值为传入的第二个参数allowed
    effect.allowRecurse = update.allowRecurse = allowed
}

// overload 1 : no hydration
// function baseCreateRenderer<
//     HostNode = RendererNode,
//     HostElement = RendererElement
// >(options: RendererOptions<HostNode, HostElement>): Renderer<HostElement>

// overload 2 : with hydration
// function baseCreateRenderer(
//     options: RendererOptions<Node, Element>,
//     createHydrationFns: typeof createHydrationFunctions
// ): HydrationRenderer

function baseCreateRenderer(
    options,
    createHydrationFns?: any
) {

    // 编译时功能标志检查
    if (__ESM_BUNDLER__ && !__TEST__) {
        console.error(`baseCreateRenderer 编译时功能检查`);
    }

    // 全局 this
    const target = getGlobalThis()

    target.__VUE__ = true
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__, target)
    }

    const {
        insert: hostInsert,
        remove: hostRemove,
        patchProp: hostPatchProp,
        createElement: hostCreateElement,
        createText: hostCreateText,
        createComment: hostCreateComment,
        setText: hostSetText,
        setElementText: hostSetElementText,
        parentNode: hostParentNode,
        nextSibling: hostNextSibling,
        setScopeId: hostSetScopeId = NOOP,
        insertStaticContent: hostInsertStaticContent
    } = options

    // 注意：闭包中的函数应使用 `const xx = () => { }`
    // 防止被模拟程序内连

    /**
     * 比较n1，n2不同执行更新还是挂载
     * n1 为 null 为挂载 反之 更新
     * 判断当前VNode的类型调用不同的处理函数
     * 
     * @param n1 之前的Vnode
     * @param n2 当前的Vnode
     * @param container 挂载的容器DOM
     * @param anchor 挂载的锚点
     * @param parentComponent 父组件
     * @param parentSuspense 父suspense
     * @param isSVG 是否是SVG
     * @param slotScopeIds 当前的插槽作用域ID
     * @param optimized 是否开启优化
    */
    const patch = (
        n1,
        n2,
        container,
        anchor = null,
        parentComponent = null,
        parentSuspense = null,
        isSVG = false,
        slotScopeIds = null,
        optimized = __DEV__ && isHmrUpdating ? false : !!n2.dynamicChildren
    ) => {
        //两个VNode相等 不做处理
        if (n1 === n2) {
            return
        }

        // 不是挂载时候 之前的vnode存在，同时是同一个节点
        if (n1 && !isSameVNodeType(n1, n2)) {
            console.error(`n1 && !isSameVNodeType(n1, n2)`,);
        }

        if (n2.patchFlag === PatchFlags.BAIL) {
            console.error(`n2.patchFlag === PatchFlags.BAIL`,);
        }

        const { type, ref, shapeFlag } = n2

        switch (type) {
            case Text: // v-txt
                console.error(`v-txt`,);
                break;
            case Comment: // v-cmt
                console.error(`v-cmt`,);
                break;
            case Static: // v-stc
                console.error(`v-stc`,);
                break;
            case Fragment: // v-fgt
                // return (_openBlock(), _createElementBlock(_Fragment, null, [_createElementVNod
                // _Fragment
                processFragment(
                    n1,
                    n2,
                    container,
                    anchor,
                    parentComponent,
                    parentSuspense,
                    isSVG,
                    slotScopeIds,
                    optimized
                )
                break;
            default:
                if (shapeFlag & ShapeFlags.ELEMENT) {
                    // element
                    processElement(
                        n1,
                        n2,
                        container,
                        anchor,
                        parentComponent,
                        parentSuspense,
                        isSVG,
                        slotScopeIds,
                        optimized
                    )
                }
                // 初始化 createApp 接收一个 组件
                else if (shapeFlag & ShapeFlags.COMPONENT) {
                    // 根据n1判断 初始化创建 还是 更新
                    processComponent(
                        n1,
                        n2,
                        container,
                        anchor,
                        parentComponent,
                        parentSuspense,
                        isSVG,
                        slotScopeIds,
                        optimized
                    )
                } else if (shapeFlag & ShapeFlags.TELEPORT) {
                    console.error(`shapeFlag & ShapeFlags.TELEPORT`, shapeFlag & ShapeFlags.TELEPORT);
                } else if (shapeFlag & ShapeFlags.SUSPENSE) { // __FEATURE_SUSPENSE__
                    console.error(`shapeFlag & ShapeFlags.SUSPENSE`, shapeFlag & ShapeFlags.SUSPENSE);

                } else if (__DEV__) {
                    console.warn('Invalid VNode type:', type, `(${typeof type})`)
                }
                break;
        }
    }

    const processText = (n1, n2, container, anchor) => {
        console.error(`processText`, n1, n2);
    }

    const processCommentNode = (n1, n2, container, anchor) => {
        console.error(`processCommentNode`, n1, n2, container, anchor);
    }

    const mountStaticNode = (n2, container, anchor: null, isSVG: boolean) => {
        console.error(`mountStaticNode`, n2, container, anchor);
    }

    // Dev / HMR only
    const patchStaticNode = (n1, n2, container, isSVG: boolean) => {
        console.error(`patchStaticNode`, n1, n2, container, isSVG);
    }

    const moveStaticNode = ({ el, anchor }, container, nextSibling: null) => {
        console.error(`moveStaticNode`, el, anchor, container, nextSibling);
    }
    const removeStaticNode = ({ el, anchor }) => {
        console.error(`removeStaticNode`, el, anchor);
    }
    const processElement = (
        n1: null,
        n2,
        container,
        anchor: null,
        parentComponent: null,
        parentSuspense: null,
        isSVG: boolean,
        slotScopeIds: string[] | null,
        optimized: boolean
    ) => {
        isSVG = isSVG || (n2.type as string) === 'svg'
        if (n1 == null) {
            // mount
            mountElement(
                n2,
                container,
                anchor,
                parentComponent,
                parentSuspense,
                isSVG,
                slotScopeIds,
                optimized
            )
        } else {
            console.error(`processElement`, `更新`);
        }
    }

    // mount element  挂载DOM元素
    const mountElement = (
        vnode,
        container,
        anchor: null,
        parentComponent: null,
        parentSuspense: any | null,
        isSVG: boolean,
        slotScopeIds: string[] | null,
        optimized: boolean
    ) => {
        let el: any
        let vnodeHook: any | undefined | null
        const { type, props, shapeFlag, transition, dirs } = vnode

        // 创建DOM节点，并绑定到当前vnode的el上
        el = vnode.el = hostCreateElement(
            vnode.type as string,
            isSVG,
            props && props.is,
            props
        )

        // 先安装子集，因为有些props可能依赖于子集
        // being already rendered ，例如“＜select value＞”`
        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            // 如果是 text 添加 内容
            hostSetElementText(el, vnode.children as string)
        } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            mountChildren(
                vnode.children as any,
                el,
                null,
                parentComponent,
                parentSuspense,
                isSVG && type !== 'foreignObject',
                slotScopeIds,
                optimized
            )
        }

        if (dirs) {
            console.error(`dirs`,);
        }

        // scopeId
        setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent)

        // props
        // 各种 静态 属性
        if (props) {
            for (const key in props) {
                if (key !== 'value' && !isReservedProp(key)) {
                    hostPatchProp(
                        el,
                        key,
                        null,
                        props[key],
                        isSVG,
                        vnode.children as any[],
                        parentComponent,
                        parentSuspense,
                        unmountChildren
                    )
                }
            }
            /**
              * 在DOM元素上设置值的特殊情况：
              * -它可以是顺序敏感的（例如，应在*min/max、#2325、#4024之后设置*）
              * -需要强制（#1471）
              * #2353建议添加另一个渲染器选项来对此进行配置，但是
              * 性能影响是如此有限，因此值得特别考虑
              * 以降低复杂性。（特殊套管也不应
              * 影响非DOM渲染器）
            */
            if ('value' in props) {
                hostPatchProp(el, 'value', null, props.value)
            }
            if ((vnodeHook = props.onVnodeBeforeMount)) {
                invokeVNodeHook(vnodeHook, parentComponent, vnode)
            }
        }

        if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
            console.error(`__DEV__ || __FEATURE_PROD_DEVTOOLS__`,);
        }

        if (dirs) {
            invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')
        }

        // #1583 For inside suspense + suspense not resolved case, enter hook should call when suspense resolved
        // #1689 For inside suspense + suspense resolved case, just call it
        const needCallTransitionHooks =
            (!parentSuspense || (parentSuspense && !parentSuspense.pendingBranch)) &&
            transition &&
            !transition.persisted
        if (needCallTransitionHooks) {
            transition!.beforeEnter(el)
        }

        // 挂载到 app
        hostInsert(el, container, anchor)

        if (
            (vnodeHook = props && props.onVnodeMounted) ||
            needCallTransitionHooks ||
            dirs
        ) {
            queuePostRenderEffect(() => {
                vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode)
                needCallTransitionHooks && transition!.enter(el)
                dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted')
            }, parentSuspense)
        }

    }

    const setScopeId = (
        el,
        vnode,
        scopeId: string | null,
        slotScopeIds: string[] | null,
        parentComponent: any | null
    ) => {
        if (scopeId) {
            hostSetScopeId(el, scopeId)
        }
        if (slotScopeIds) {
            for (let i = 0; i < slotScopeIds.length; i++) {
                hostSetScopeId(el, slotScopeIds[i])
            }
        }
        if (parentComponent) {
            let subTree = parentComponent.subTree
            if (
                __DEV__ &&
                subTree.patchFlag > 0 &&
                subTree.patchFlag & PatchFlags.DEV_ROOT_FRAGMENT
            ) {
                subTree = filterSingleRoot(subTree.children as any) || subTree
            }
            if (vnode === subTree) {
                const parentVNode = parentComponent.vnode
                setScopeId(
                    el,
                    parentVNode,
                    parentVNode.scopeId,
                    parentVNode.slotScopeIds,
                    parentComponent.parent
                )
            }
        }
    }

    // 挂载子节点数组
    const mountChildren = (
        children,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized,
        start = 0
    ) => {
        // 循环 children 节点
        for (let i = start; i < children.length; i++) {
            const child = (children[i] = optimized
                ? cloneIfMounted(children[i] as any)
                : normalizeVNode(children[i]))


            patch(
                null,
                child,
                container,
                anchor,
                parentComponent,
                parentSuspense,
                isSVG,
                slotScopeIds,
                optimized
            )
        }
    }

    const patchElement = (
        n1,
        n2,
        parentComponent: null,
        parentSuspense: null,
        isSVG: boolean,
        slotScopeIds: string[] | null,
        optimized: boolean
    ) => {
        console.error(`patchElement`, n1, n2);
    }

    const patchBlockChildren = (
        oldChildren,
        newChildren,
        fallbackContainer,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds
    ) => {
        console.error(`patchBlockChildren`, oldChildren, newChildren);
    }

    const patchProps = (
        el,
        vnode,
        oldProps,
        newProps,
        parentComponent: null,
        parentSuspense: null,
        isSVG: boolean
    ) => {
        console.error(`patchProps`, el, vnode);
    }

    // 处理fragment节点
    const processFragment = (
        n1: any = null,
        n2: any,
        container,
        anchor: null,
        parentComponent: null,
        parentSuspense: null,
        isSVG: boolean,
        slotScopeIds: string[] | null,
        optimized: boolean
    ) => {
        // 开始
        const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!
        // 结束的文本节点
        const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))!

        let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2


        if (
            __DEV__ &&
            // #5523 dev root fragment may inherit directives
            (isHmrUpdating || patchFlag & PatchFlags.DEV_ROOT_FRAGMENT)
        ) {
            // HMR updated / Dev root fragment (w/ comments), force full diff
            patchFlag = 0
            optimized = false
            dynamicChildren = null
        }

        // 检查这是否是一个带有： slotted-scope-ids 的slot片段
        if (fragmentSlotScopeIds) {
            slotScopeIds = slotScopeIds
                ? slotScopeIds.concat(fragmentSlotScopeIds)
                : fragmentSlotScopeIds
        }

        // 初始化进来
        if (n1 == null) {
            hostInsert(fragmentStartAnchor, container, anchor)
            hostInsert(fragmentEndAnchor, container, anchor)
            // fragment 只能有数组 children
            // 因为是由编译器生成的，要么是隐式创建的
            // 挂载子节点数组
            mountChildren(
                n2.children as any,
                container,
                fragmentEndAnchor,
                parentComponent,
                parentSuspense,
                isSVG,
                slotScopeIds,
                optimized
            )
        } else {
            console.error(`n1 存在`, n1);
        }
    }

    // 根据n1判断 初始化创建 还是 更新
    const processComponent = (
        n1: null,
        n2,
        container,
        anchor: null,
        parentComponent: null,
        parentSuspense: null,
        isSVG: boolean,
        slotScopeIds: string[] | null,
        optimized: boolean
    ) => {
        n2.slotScopeIds = slotScopeIds
        // 第一次加载
        if (n1 == null) {
            // 是否是被Keep-Alive包裹的组件
            if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
                // 执行组件的activate钩子
                console.error(`n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE`, n1, n2);

            } else {
                // mount
                // 初始化组件实例
                // 老节点不存在时的processComponent
                mountComponent(
                    n2,
                    container,
                    anchor,
                    parentComponent,
                    parentSuspense,
                    isSVG,
                    optimized
                )
            }
        } else {
            // 判断组件是否需要更新
            // 主要会对组件的新旧Props、子节点进行判断
            // 如果发生变化，会调用mountComponent阶段创建的updateEffect，触发响应式系统
            // 否则直接原有的直接进行覆盖
            updateComponent(n1, n2, optimized)
        }
    }

    const mountComponent = (
        initialVNode,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        optimized
    ) => {
        // v2 false
        const compatMountInstance = __COMPAT__ && initialVNode.isCompatRoot && initialVNode.component
        // 创建 组件实例
        const instance = compatMountInstance || (initialVNode.component = createComponentInstance(
            initialVNode,
            parentComponent,
            parentSuspense
        ))

        // 注册热更新
        if (__DEV__ && instance.type.__hmrId) {
            registerHMR(instance)
        }

        // 挂载性能检测
        if (__DEV__) {
            pushWarningContext(initialVNode)
            startMeasure(instance, `mount`)
        }

        // keep-alive
        if (isKeepAlive(initialVNode)) {
            console.error(`keepoAlive`,);
        }

        if (!(__COMPAT__ && compatMountInstance)) {
            if (__DEV__) {
                console.error(`startMeasure(instance, init)`);
            }
            // 处理setup：这个函数里使用其它方法，初始化了props和插槽，且调用了setup
            /**
             * 1、初始化props、defineProps
             * 2、初始化 slot
             * 3、处理 setup script 内 code
             */
            setupComponent(instance)
            if (__DEV__) {
                console.error(`endMeasure(instance, init)`);
            }
        }

        if (__FEATURE_SUSPENSE__ && instance.asyncDep) {
            console.error(`__FEATURE_SUSPENSE__ && instance.asyncDep`,);
        }

        // 创建更新函数，创建更新机制，首次更新视图
        setupRenderEffect(
            instance,
            initialVNode,
            container,
            anchor,
            parentSuspense,
            isSVG,
            optimized
        )

        if (__DEV__) {
            console.error(`__DEV__`,);
        }
    }

    const updateComponent = (n1, n2, optimized: boolean) => {
        console.error(`updateComponent`, n1, n2);
    }

    const setupRenderEffect = (
        instance,
        initialVNode,
        container,
        anchor,
        parentSuspense,
        isSVG,
        optimized
    ) => {
        // 创建更新函数
        const componentUpdateFn = () => {
            // 判断mounted
            if (!instance.isMounted) {
                // 如果mounted为false
                let vnodeHook: any | null | undefined
                // 获取el和props
                const { el, props } = initialVNode
                // 获取beforeMounted mounted钩子和parent
                const { bm, m, parent } = instance
                const isAsyncWrapperVNode = isAsyncWrapper(initialVNode)

                toggleRecurse(instance, false)
                // beforeMount hook
                if (bm) {
                    console.error(`bm---?`,);
                }
                // onVnodeBeforeMount
                if (
                    !isAsyncWrapperVNode &&
                    (vnodeHook = props && props.onVnodeBeforeMount)
                ) {
                    console.error(`!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)`,);
                }

                if (__COMPAT__) {
                    console.error(`__COMPAT__ isCompatEnabled(DeprecationTypes.INSTANCE_EVENT_HOOKS, instance)`,);
                }

                toggleRecurse(instance, true)

                if (el && hydrateNode) {
                    console.error(`el && hydrateNode`,);
                } else {
                    if (__DEV__) {
                        console.error(`__DEV__`,);
                    }
                    // 首次渲染逻辑
                    // 执行<template>转化的render()函数，触发响应式数据的getter，进行依赖收集
                    // vnode
                    const subTree = (instance.subTree = renderComponentRoot(instance))
                    if (__DEV__) {
                        endMeasure(instance, `render`)
                    }
                    if (__DEV__) {
                        startMeasure(instance, `patch`)
                    }

                    patch(
                        null,
                        subTree,
                        container,
                        anchor,
                        instance,
                        parentSuspense,
                        isSVG
                    )

                    if (__DEV__) {
                        endMeasure(instance, `patch`)
                    }
                    initialVNode.el = subTree.el
                }
            } else {
                console.error(`setupRenderEffect->componentUpdateFn`, 2);
            }
        }

        // 创建更新机制 当发生更新时，触发依赖，这里就会执行上面注册的componentUpdateFn函数去更新
        const effect = (instance.effect = new ReactiveEffect(
            componentUpdateFn,
            () => queueJob(update),
            instance.scope // track it in component's effect scope
        ))

        // 通过effect.run拿到我们的componentUpdateFn函数
        const update: any = (instance.update = () => effect.run())
        update.id = instance.uid
        // allowRecurse
        // #1801, #2043 component render effects should allow recursive updates
        toggleRecurse(instance, true)

        if (__DEV__) {
            console.error(`__DEV__`,);
        }

        // 首次更新视图
        // 执行一次componentUpdateFn，因为首次挂载，没有更新，所以直接进行render，patch渲染视图
        update()

        console.log(print(filename, 'setupRenderEffect',));
    }

    const updateComponentPreRender = (
        instance,
        nextVNode,
        optimized: boolean
    ) => {
        console.error(`updateComponentPreRender`, instance);
    }

    const patchChildren = (
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        optimized = false
    ) => {
        console.error(`patchChildren`, n1, n2);
    }

    const patchUnkeyedChildren = (
        c1,
        c2,
        container,
        anchor: null,
        parentComponent: null,
        parentSuspense: null,
        isSVG: boolean,
        slotScopeIds: string[] | null,
        optimized: boolean
    ) => {
        console.error(`patchUnkeyedChildren`, c1, c2);
    }


    const patchKeyedChildren = (
        c1,
        c2,
        container,
        parentAnchor: null,
        parentComponent: null,
        parentSuspense: null,
        isSVG: boolean,
        slotScopeIds: string[] | null,
        optimized: boolean
    ) => {
        console.error(`patchKeyedChildren`, c1, c2);
    }

    const move = (
        vnode,
        container,
        anchor,
        moveType,
        parentSuspense = null
    ) => {
        console.error(`move`, vnode, container);
    }

    const unmount = (
        vnode,
        parentComponent,
        parentSuspense,
        doRemove = false,
        optimized = false
    ) => {
        console.error(`unmount`, vnode);
    }

    const remove = vnode => {
        console.error(`remove`, vnode);
    }

    const removeFragment = (cur, end) => {
        console.error(`removeFragment`, cur, end);
    }

    const unmountComponent = (instance, parentSuspense: null, doRemove?: boolean) => {
        console.error(`unmountComponent`, instance, parentSuspense, doRemove);
    }

    const unmountChildren = (
        children,
        parentComponent,
        parentSuspense,
        doRemove = false,
        optimized = false,
        start = 0
    ) => {
        console.error(`unmountChildren`, children, parentSuspense, doRemove);
    }

    const getNextHostNode = vnode => {
        console.error(`getNextHostNode`, vnode);
    }

    const render = (vnode, container, isSVG) => {
        // 不存在 卸载组件
        if (vnode == null) {
            console.error(`render vnode == null`,);
        } else {
            // 存在则对新旧Vnode进行patch
            // patch是一个递归的过程
            patch(container._vnode || null, vnode, container, null, null, null, isSVG)
        }
        console.log(print(filename, `baseCreateRenderer->render`));
    }

    const internals = {
        p: patch,
        um: unmount,
        m: move,
        r: remove,
        mt: mountComponent,
        mc: mountChildren,
        pc: patchChildren,
        pbc: patchBlockChildren,
        n: getNextHostNode,
        o: options
    }

    let hydrate: undefined
    let hydrateNode: undefined
    if (createHydrationFns) {
        console.error(`createHydrationFns->`, createHydrationFns);
    }

    return {
        render,
        hydrate,
        createApp: createAppAPI(render, hydrate)
    }
}

// 主要判断新旧虚拟节点是否是同一个节点
export function isSameVNodeType(n1, n2): boolean {
    if (
        __DEV__ &&
        n2.shapeFlag & ShapeFlags.COMPONENT &&
        hmrDirtyComponents.has(n2.type as any)
    ) {
        // #7042, ensure the vnode being unmounted during HMR
        // bitwise operations to remove keep alive flags
        n1.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        n2.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
        // HMR only: if the component has been hot-updated, force a reload.
        return false
    }
    return n1.type === n2.type && n1.key === n2.key
}