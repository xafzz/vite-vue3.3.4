import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { basename, resolve } from 'path';
import json from '@rollup/plugin-json'
import esbuild from 'rollup-plugin-esbuild'
import pluginCommonJs from '@rollup/plugin-commonjs';
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

const version = pkg.version

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
  global: {
    file: resolve(packageDir, `dist/${name}.global.js`),
    format: `iife`
  }
}

// 导出配置
function createConfig(format, output) {

  output.name = packageOptions.name
  output.sourcemap = true

  return {
    // 入口
    input: resolve(packageDir, `src/index.ts`),
    external: [
      'lru-cache'
    ],
    plugins: [
      json(),
      pluginCommonJs({
        transformMixedEsModules: true,
        sourceMap: false,
      }),
      nodeResolve(),
      ts({
        tsconfig: resolve(__dirname, 'tsconfig.json'),
      }),
      esbuild({
        tsconfig: resolve(__dirname, 'tsconfig.json'),
        sourceMap: output.sourcemap,
        minify: false,
        target:'es2015',
        define: {
          __DEV__: 'true',
          __BROWSER__: 'true',
          __NUMBER__: '1',
          __VERSION__: `'${version}'`,
          __TEST__: 'false',
          __COMPAT__: 'false',
          __ESM_BUNDLER__: 'false',
          __FEATURE_PROD_DEVTOOLS__: 'false'
        }
      }),
    ],
    output,
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    },
    treeshake: {
      moduleSideEffects: false
    }
  }
}

export default packageOptions.formats.map(format => createConfig(format, outputConfigs[format]))