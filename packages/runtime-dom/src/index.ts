import { extend, isFunction, isString, print,isHTMLTag, isSVGTag } from "@vue/shared";
import { createRenderer,isRuntimeOnly } from "@vue/runtime-core";
import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";

const filename = 'runtime-dom/index.ts'

// nodeOps 集合了原生dom方法，处理dom
// patchProp  处理元素属性方法等
const rendererOptions = /*#__PURE__*/ extend({ patchProp }, nodeOps)

//惰性地创建渲染器-这使得核心渲染器逻辑树不稳定
//以防用户仅从Vue导入反应性实用程序。
let renderer

// 创建应用 调用方法 
// 入口
export const createApp = (...args) => {
    // ensureRenderer 是一个单例模式的函数，会返回一个renderer
    // 如果没有则调用createRenderer进行获取renderer 
    // 获得一个app实例
    const app = ensureRenderer().createApp(...args)

    if (__DEV__) {
        // 验证组件名称是否是原生标签或者svg属性标签
        injectNativeTagCheck(app)
        // 检查CompilerOptions如果有已弃用的属性，显示警告
        injectCompilerOptionsCheck(app)
    }

    // 从创建的app对象中解构获取mount，改写mount方法后 返回app实例
    const { mount } = app
    app.mount = (containerOrSelector: Element | ShadowRoot | String): any => {
        // document.querySelector 过程
        const container = normalizeContainer(containerOrSelector)
        if (!container) return

        // 这里的app._component 其实就是全局API的createApp的第一个参数
        const component = app._component
        // 不是函数 不存在 render 和 template
        if (!isFunction(component) && !component.render && !component.template) {
            // 可能在dom模板中执行JS表达式。
            // 如果是模版,用户必须确保内dom模板是可信的。
            // 如果是服务器渲染,该模板不应该包含任何用户数据。

            //  使用 DOM的innerHTML作为component.template 内容
            component.template = container.innerHTML

            // 兼容2.x
            if (__COMPAT__ && __DEV__) {
                console.error(`兼容2.x`);
            }
        }

        // 挂载之前清空下
        container.innerHTML = ''
        // 真正的挂载  是否为svg
        const proxy = mount(container, false, container instanceof SVGAElement)
        console.warn(``, proxy,22,container);

        if (container instanceof Element) {
            // 防止闪烁变量名
            // 先隐藏文件挂载的位置 处理好渲染后显示最终的结果 需要跟 css 一起使用
            container.removeAttribute('v-cloak')
            container.setAttribute('data-v-app', '')
        }
        return proxy
    }

    console.log(print(filename, 'createApp'), app);

    return app
}

function ensureRenderer() {
    return renderer || (renderer = createRenderer(rendererOptions))
}


function injectNativeTagCheck(app) {
    Object.defineProperty(app.config, 'isNativeTag', {
        value: (tag: string) => isHTMLTag(tag) || isSVGTag(tag),
        writable: false
    })
}

function injectCompilerOptionsCheck(app) {
    if (isRuntimeOnly()) {
        const isCustomElement = app.config.isCustomElement
        Object.defineProperty(app.config, 'isCustomElement', {
            get() {
                return isCustomElement
            },
            set() {
                console.warn(
                    `不赞成使用'isCustomElement',请使用'compilerOptions.isCustomElement'`
                )
            }
        })
        const compilerOptions = app.config.compilerOptions
        const msg =
            `The \`compilerOptions\` config option is only respected when using ` +
            `a build of Vue.js that includes the runtime compiler (aka "full build"). ` +
            `Since you are using the runtime-only build, \`compilerOptions\` ` +
            `must be passed to \`@vue/compiler-dom\` in the build setup instead.\n` +
            `- For vue-loader: pass it via vue-loader's \`compilerOptions\` loader option.\n` +
            `- For vue-cli: see https://cli.vuejs.org/guide/webpack.html#modifying-options-of-a-loader\n` +
            `- For vite: pass it via @vitejs/plugin-vue options. See https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue#example-for-passing-options-to-vuecompiler-sfc`

        Object.defineProperty(app.config, 'compilerOptions', {
            get() {
                console.warn(msg)
                return compilerOptions
            },
            set() {
                console.warn(msg)
            }
        })
    }
}

function normalizeContainer(container) {
    // '#app'
    if (isString(container)) {
        const res = document.querySelector(container)
        if (__DEV__ && !res) {
            console.warn(`挂载失败,${container}不存在`)
        }
        return res
    }

    if (
        __DEV__ &&
        window.ShadowRoot &&
        container instanceof window.ShadowRoot &&
        container.mode === 'closed'
    ) {
        console.warn(
            `以\`"{mode： "closed"}\` 可能会导致不可预测的错误`
        )
    }
    return container as any
}


// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from '@vue/runtime-core'