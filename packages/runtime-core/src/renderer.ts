import { getGlobalThis, print } from "@vue/shared";
import { createAppAPI } from "./apiCreateApp";



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
    if ( __ESM_BUNDLER__ && !__TEST__) { 
        console.error(`baseCreateRenderer 编译时功能检查`);
    }

    // 全局 this
    const target = getGlobalThis()
    
    target.__VUE__ = true
    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) { 
        console.error('vue-tools');
    }

    // 此处省略 options

    const render = (vnode,container,isSVG) => { 
        console.error(print(filename,`baseCreateRenderer->render`),);
    }

    let hydrate: undefined
    

    return {
        render,
        hydrate,
        createApp:createAppAPI(render,hydrate)
    }
}