import { NOOP, PatchFlags, ShapeFlags, getGlobalThis, print } from "@vue/shared";
import { createAppAPI } from "./apiCreateApp";
import { hmrDirtyComponents, isHmrUpdating } from "./hmr";
import { setDevtoolsHook } from "./devtools";
import { Comment, Fragment, Static, Text } from "./vnode";


const filename = 'runtime-core/renderer.ts'

//  createRenderer<Node, Element>
export function createRenderer(options) {
    return baseCreateRenderer(options)
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
        console.log(``, 22222);
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
        console.log(``, 333333, type, ref, shapeFlag);
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
                console.error(`v-fgt`,);
                break;
            default:
                if (shapeFlag & ShapeFlags.ELEMENT) {
                    console.error(`shapeFlag & ShapeFlags.ELEMENT`, shapeFlag & ShapeFlags.ELEMENT);
                } else if (shapeFlag & ShapeFlags.COMPONENT) {
                    console.error(`shapeFlag & ShapeFlags.COMPONENT`, shapeFlag & ShapeFlags.COMPONENT);
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
        console.error(`patch`, n1, n2);
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
        console.error(`processElement`, n1, n2, anchor);
    }

    const mountElement = (
        vnode,
        container,
        anchor: null,
        parentComponent: null,
        parentSuspense: null,
        isSVG: boolean,
        slotScopeIds: string[] | null,
        optimized: boolean
    ) => {
        console.error(`mountElement`, vnode, container, anchor);
    }

    const setScopeId = (
        el,
        vnode,
        scopeId: string | null,
        slotScopeIds: string[] | null,
        parentComponent: null
    ) => {
        console.error(`setScopeId`, el, vnode, scopeId);
    }

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
        console.error(`mountChildren`, children, container);
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

    const processFragment = (
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
        console.error(`processFragment`, n1, n2);
    }

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
            if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
                console.error(`n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE`, n1, n2);

            } else { 
                // mount
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
        console.error(`mountComponent`, initialVNode, container);
        // v2 false
        const compatMountInstance = __COMPAT__ && initialVNode.isCompatRoot && initialVNode.component
        console.warn(``,compatMountInstance);
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
        console.error(`setupRenderEffect`, instance, initialVNode);
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
        if (vnode == null) {
            console.error(`render vnode == null`,);
        } else {
            console.log(``, 111111);
            //挂载元素
            patch(container._vnode || null, vnode, container, null, null, null, isSVG)
        }
        console.log(print(filename, `baseCreateRenderer->render`),);
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