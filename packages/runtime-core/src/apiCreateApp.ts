import { NO, extend, isFunction, isObject, print } from "@vue/shared";
import { version } from ".";
import { VNode, cloneVNode, createVNode } from "./vnode";
import { Data } from "./component";


const filename = 'runtime-core/apiCreateApp.ts'

let uid = 0

export interface App<HostElement = any> {
    version: string
    config: AppConfig

    use<Options extends unknown[]>(
        plugin: Plugin<Options>,
        ...options: Options
    ): this
    use<Options>(plugin: Plugin<Options>, options: Options): this

    mixin(mixin): this
    component(name: string): undefined
    component(name: string, component: any): this
    directive(name: string): undefined
    directive(name: string, directive: any): this
    mount(
        rootContainer: HostElement | string,
        isHydrate?: boolean,
        isSVG?: boolean
    ): any
    unmount(): void
    provide<T>(key: any, value: T): this

    /**
     * Runs a function with the app as active instance. This allows using of `inject()` within the function to get access
     * to variables provided via `app.provide()`.
     *
     * @param fn - function to run with the app as active instance
     */
    runWithContext<T>(fn: () => T): T

    // internal, but we need to expose these for the server-renderer and devtools
    _uid: number
    _component: any
    _props: null
    _container: HostElement | null
    _context: AppContext
    _instance: null

    /**
     * v2 compat only
     */
    filter?(name: string): Function | undefined
    filter?(name: string, filter: Function): this

    /**
     * @internal v3 compat only
     */
    _createRoot?(options: any)
}


export type OptionMergeFunction = (to: unknown, from: unknown) => any

export interface AppConfig {
    // @private
    readonly isNativeTag?: (tag: string) => boolean

    performance: boolean
    optionMergeStrategies: Record<string, any>
    globalProperties: Record<string, any>
    errorHandler?: (
        err: unknown,
        instance: null,
        info: string
    ) => void
    warnHandler?: (
        msg: string,
        instance: null,
        trace: string
    ) => void

    /**
     * Options to pass to `@vue/compiler-dom`.
     * Only supported in runtime compiler build.
     */
    compilerOptions: any

    /**
     * @deprecated use config.compilerOptions.isCustomElement
     */
    isCustomElement?: (tag: string) => boolean

    // TODO remove in 3.4
    /**
     * Temporary config for opt-in to unwrap injected refs.
     * @deprecated this no longer has effect. 3.3 always unwraps injected refs.
     */
    unwrapInjectedRef?: boolean
}


export interface AppContext {
    app: App // for devtools
    config: AppConfig
    mixins: any[]
    components: Record<string, any>
    directives: Record<string, any>
    provides: Record<string | symbol, any>

    /**
     * Cache for merged/normalized component options
     * Each app instance has its own cache because app-level global mixins and
     * optionMergeStrategies can affect merge behavior.
     * @internal
     */
    optionsCache: WeakMap<any, any>
    /**
     * Cache for normalized props options
     * @internal
     */
    propsCache: WeakMap<any, any>
    /**
     * Cache for normalized emits options
     * @internal
     */
    emitsCache: WeakMap<any, any>
    /**
     * HMR only
     * @internal
     */
    reload?: () => void
    /**
     * v2 compat only
     * @internal
     */
    filters?: Record<string, Function>
}

type PluginInstallFunction<Options> = Options extends unknown[]
    ? (app: App, ...options: Options) => any
    : (app: App, options: Options) => any

export type Plugin<Options = any[]> =
    | (PluginInstallFunction<Options> & {
        install?: PluginInstallFunction<Options>
    })
    | {
        install: PluginInstallFunction<Options>
    }


export type CreateAppFunction<HostElement> = (
    rootComponent: any,
    rootProps?: Data | null
) => App<HostElement>

/**
 * @internal Used to identify the current app when using `inject()` within
 * `app.runWithContext()`.
 */
export let currentApp: App<unknown> | null = null

export function createAppAPI(
    render,
    hydrate?: any
) {
    // 返回 挂载的属性 方法
    return function createApp(rootComponent, rootProps = null) {

        // 取出来的不一样
        if (!isFunction(rootComponent)) {
            rootComponent = extend({}, rootComponent)
        }

        // 传递给根组件的 props 必须是一个对象
        if (rootProps != null && !isObject(rootProps)) {
            __DEV__ && console.warn(`传递给app.mount()必须是一个对象`)
            rootProps = null
        }

        // 默认配置
        const context = createAppContext()
        // 储存安装过的插件
        const installedPlugins = new Set()

        let isMounted = false

        const app = (context.app = {
            _uid: uid++, //标识组件的唯一id
            _component: rootComponent,  //存放当前组件通过编译后的数据
            _props: rootProps, //组件参数
            _container: null, // 当前组件渲染的真实dom位置
            _context: context, //当前组件上下文
            _instance: null, // 当前组件实例对象

            version,

            get config() {
                return context.config
            },

            set config(v) {
                console.warn(`不能替换'app.config',请修改个别选项`)
            },
            // 注册插件
            use(plugin, ...options) {
                console.error(`use`);
                return app
            },
            // mixin 混入
            mixin(mixin) {
                console.error(`mixin`);
                return app
            },
            // 组件
            component(name, component?: any) {
                console.error(`component`);
                return app
            },
            // 指令
            directive(name, directive?: any) {
                console.error(`directive`);
                return app
            },
            // 最重要的api
            /**
             * createVNode将我们的根组件App转换成VNode，然后执行render将虚拟dom渲染为真实dom。
             * 
             * @param rootContainer 真实的dom元素,但是在使用时只传入一个id(app.mount('#app')),而获取dom的过程则是在编译器compiler中完成
             * @param isHydrate 
             * @param isSVG 
             * @returns 
             */
            mount(rootContainer, isHydrate?: boolean, isSVG?: boolean) {
                // 根据闭包的变量isMounted来判断app是否已经挂载
                if (!isMounted) {
                    // 相同的组件放入相同的容器中
                    if (__DEV__ && (rootContainer as any).__vue_app__) {
                        console.warn(`主机容器上已经安装了一个应用程序实例.\n
                        如果要在同一主机容器上装载另一个应用程序，\n
                       您需要先调用'app.unmount'来卸载上一个应用程序`)
                    }
                    //创建组件的VNode
                    const vnode = createVNode(rootComponent, rootProps)

                    // 在根 VNode 上存储应用程序上下文。
                    // 这将在初始挂载时设置在根实例上。
                    vnode.appContext = context

                    //
                    if (__DEV__) {
                        context.reload = () => {
                            console.error(`context.reload`);
                            // render(cloneVNode(vnode), rootContainer, isSVG)
                        }
                    }

                    if (isHydrate && hydrate) {
                        console.error(`isHydrate && hydrate`);
                        // hydrate(vnode as VNode<Node, Element>, rootContainer as any)
                    } else {
                        render(vnode, rootContainer, isSVG)
                    }

                    isMounted = true
                    app._container = rootContainer

                }
            },
            // 卸载组件
            unmount() {
                // 通过isMounted来过滤
                console.error(`unmount`);
            },
            // 隔代传值
            provide(key, value) {
                console.error(`provide`);
                return app
            },
            runWithContext(fn) {
                console.error(`runWithContext`);
                currentApp = app
                try {
                    return fn()
                } finally {
                    currentApp = null
                }
            }
        })

        if (__COMPAT__) {
            console.error(`兼容vue2`);
        }

        console.log(print(filename, `createAppAPI`), app);
        return app
    }
}

export function createAppContext(): AppContext {
    return {
        app: null as any,
        config: {
            isNativeTag: NO,
            performance: false,
            globalProperties: {},
            optionMergeStrategies: {},
            errorHandler: undefined,
            warnHandler: undefined,
            compilerOptions: {}
        },
        mixins: [],
        components: {},
        directives: {},
        provides: Object.create(null),
        optionsCache: new WeakMap(),
        propsCache: new WeakMap(),
        emitsCache: new WeakMap()
    }
}