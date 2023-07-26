# createApp


### [globalThis](https://www.9991024.com/JavaScript/built-in-objects/globalThis.html)

全局属性 `globalThis` 包含全局的 `this` 值，类似于全局对象`（global object）`

- 在 Web 中，
  可以通过 `window`、`self` 或者 `frames` 取到全局对象
- 在 Web Workers 中
  只有 `self` 
- 在 Node.js 中
  它们都无法获取，必须使用 `global`