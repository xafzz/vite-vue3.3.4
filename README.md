# pnpm+Monorepo+rollup


[配置步骤:http://www.9991024.com/Monorepo/pnpm-monorepo-rollup.html](http://www.9991024.com/Monorepo/pnpm-monorepo-rollup.html)


延用之前写vue2.6的思路，用`koa`+`http`进行搭建，`chokidar`监听文件变化,`socket.io`自动刷新

## 依赖

#### [esbuild](https://esbuild.bootcss.com/)

```
pnpm add esbuild -D 
```

#### [minimist](https://github.com/minimistjs/minimist)

```
pnpm add minimist -D 
```

## 初始化项目

```
pnpm init
```
根目录下`package.json`添加

```json
{
  "packageManager": "pnpm@7.5.2",
  "private": true,
  "workspaces": [
    "packages/*"
  ]
}
```

## 创建子包

```
mkdir packages packages/compiler-sfc packages/shared
```

使用`npm init`初始化子包

```
npm init -w ./packages/compiler-sfc 
npm init -w ./packages/shared
```

目录结构为：

```
.
+-- node_modules
|  `-- compiler-sfc  -> ../packages/compiler-sfc 
|  `-- shared  -> ../shared
+-- package-lock.json
+-- package.json
`-- packages
   +-- compiler-sfc 
   |   `-- package.json
   +-- shared
   |   `-- package.json
```

## 添加依赖
  
- 指定包的依赖

  pnpm 可以通过-F 来选择不同的子包。语法：
  ```
  pnpm -F 子包名 add 需要下载的包名
  ```
  例:`compiler-sfc`添加`@babel/parser`
  ```
  pnpm -F compiler-sfc add @babel/parser -D 
  ```


- 共用的依赖

  ::: warning 根目录下存在`pnpm-workspace.yaml`文件

    在执行`pnpm add xx`时，需要添加`-w`,例：

    ```
      pnpm add -w typescript -D
    ```

  :::
  
  - 添加`typescript`
    
    ```
    pnpm add typescript -D
    ```
  
    生成`tsconfig.json`
  
    ```
    npx tsc --init
    ```

  - 添加`rollup`相关依赖

    ```
    pnpm add rollup execa rollup-plugin-typescript2 @rollup/plugin-node-resolve @rollup/plugin-json -D
    ```
    
## 运行

#### 脚本文件

通过`mkdir scripts`创建`scripts`文件夹，并创建`build.js`

```
+-- scripts
|  `-- build.js  -> pnpm build
```

#### build.js

```js
import { readdirSync, statSync } from 'fs'
import { execa } from 'execa'

// 获取打包目录
const dirs = readdirSync('packages').filter(dir => statSync(`packages/${dir}`).isDirectory())

// 对获取的目录进行打包
buildAll()

async function buildAll() {
    await runParallel(build).then(() => {
        console.log('ok')
    }).catch(e => {
        console.log(e);
    })
}

async function runParallel(fn) {

    let result = []

    for (const dir of dirs) {
        result.push(fn(dir))
    }

    return Promise.all(result)
}

async function build(target) {
    // 并行打包
    await execa(
        'rollup',
        [
            '-c', //执行rollup的配置
            '--environment', //环境变量
            `TARGET:${target}`
        ],
        { stdio: 'inherit' } // 输出子进程的日志
    )
}
```

#### rollup.config.js

```js
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { basename, resolve } from 'path';
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import ts from 'rollup-plugin-typescript2'

const require = createRequire(import.meta.url)
// 根目录
const __dirname = fileURLToPath(new URL('.', import.meta.url))

// 子包的根目录
// build.js 中定义的`TARGET:${target}` 就是 process.env.TARGET
const packageDir = resolve(__dirname, `packages/${process.env.TARGET}`)
// 每个包的package.json
const pkg = require(resolve(packageDir, `package.json`))
// 自定义的`buildOptions`
const packageOptions = pkg.buildOptions || {}
const name = basename(process.env.TARGET)

const outputConfigs = {
  'esm-bundler': {
    file: resolve(packageDir, `dist/${name}.esm-bundler.js`),
    format: `es`
  },
  'esm-browser': {
    file: resolve(packageDir, `dist/${name}.esm-browser.js`),
    format: `es`
  },
  cjs: {
    file: resolve(packageDir, `dist/${name}.cjs.js`),
    format: `cjs`
  },
}

// 导出配置

function createConfig(format, output) {

  output.name = packageOptions.name
  output.sourcemap = false

  return {
    // 入口
    input: resolve(packageDir, `src/index.ts`),
    output,
    plugins: [
      json(),
      ts({
        tsconfig: resolve(__dirname, 'tsconfig.json'),
      }),
      nodeResolve()
    ]
  }
}

export default packageOptions.formats.map(format => createConfig(format, outputConfigs[format]))
```

#### 执行`build`

```
pnpm build
```

`packages/shared/dist`中：

```
+-- dist
|  `-- shared.cjs.js
|  `-- shared.cjs.js.map
|  `-- shared.esm-bundler.js
|  `-- shared.esm-bundler.js.map
```

`packages/compiler-sfc/dist`中：

```
+-- dist
|  `-- compiler-sfc.cjs.js
|  `-- compiler-sfc.cjs.js.map
|  `-- compiler-sfc.esm-browser.js
|  `-- compiler-sfc.esm-browser.js.map
```

## Using workspaces

#### tsconfig.json

```
{
  "compilerOptions": {
    // 修改 
    "target": "ES2016",  
    "module": "ES6",  
    "sourceMap": true, 
    "moduleResolution": "node",
    // 添加
    "baseUrl": ".",         
    "paths": {
      "@vue/*": ["packages/*/src"]
    }
  }
}
```

#### 在`packages/compiler-sfc`引入`packages/shared`

`packages/compiler-sfc/src/index.ts`

```
import { e } from  '@vue/shared'

let a = 1

let x = e
console.log(e)

export { 
    a,
    x
}
```

`packages/shared/src/index.ts`

```
let e = 4

export { 
    e
}
```

执行`pnpm build`,查看`compiler-sfc.cjs.js`

```
'use strict';

let e = 4;

let a = 1;
let x = e;
console.log(e);

exports.a = a;
exports.x = x;
```


