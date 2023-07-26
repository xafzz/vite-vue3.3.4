import { NOOP, getGlobalThis, print } from "@vue/shared";
import { createAppAPI } from "./apiCreateApp";
import { isHmrUpdating } from "./hmr";



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
        console.error('vue-tools');
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
        console.error(`processComponent`, n1, n2);
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
        console.error(`removeFragment`, cur,end);
    }
    
    const unmountComponent = (instance,parentSuspense:  null,doRemove?: boolean ) => { 
        console.error(`unmountComponent`, instance,parentSuspense,doRemove);
    }

    const unmountChildren = (
        children,
        parentComponent,
        parentSuspense,
        doRemove = false,
        optimized = false,
        start = 0
    ) => { 
        console.error(`unmountChildren`, children,parentSuspense,doRemove);
    }

    const getNextHostNode = vnode => { 
        console.error(`getNextHostNode`, vnode);
    }

    const render = (vnode, container, isSVG) => {
        console.error(print(filename, `baseCreateRenderer->render`),);
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
        console.error(`createHydrationFns->`,createHydrationFns);
    }

    return {
        render,
        hydrate,
        createApp: createAppAPI(render, hydrate)
    }
}