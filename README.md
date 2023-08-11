# createApp


### [globalThis](https://www.9991024.com/JavaScript/built-in-objects/globalThis.html)

全局属性 `globalThis` 包含全局的 `this` 值，类似于全局对象`（global object）`

- 在 Web 中，
  可以通过 `window`、`self` 或者 `frames` 取到全局对象
- 在 Web Workers 中
  只有 `self` 
- 在 Node.js 中
  它们都无法获取，必须使用 `global`


### __DEV__ false  

### mountComponent

#### 1、createComponentInstance

创建 组件实例

#### 2、setupComponent

1、初始化props、defineProps

  initProps()

2、初始化 slot

  initSlots()

3、处理 setup script 内 code

  setupStatefulComponent()

#### 3、setupRenderEffect

创建更新函数，创建更新机制，首次更新视图