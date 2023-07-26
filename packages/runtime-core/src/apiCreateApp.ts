import { NO, extend, isFunction, isObject, print } from "@vue/shared";
import { version } from ".";
import { createVNode } from "./vnode";


const filename = 'runtime-core/apiCreateApp.ts'

let uid = 0

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

        const isMounted = false

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
                    
                    const vnode = createVNode(rootComponent,rootProps)
                    console.log(print(filename, `mount`), vnode);

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
            }
        })

        if (__COMPAT__) {
            console.error(`兼容vue2`);
        }

        console.log(print(filename, `createAppAPI`), app);
        return app
    }
}

export function createAppContext() {
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