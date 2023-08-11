
declare var __DEV__: boolean

declare var __BROWSER__: boolean

declare var __COMPAT__: boolean

declare var __NUMBER__: number

declare var __TEST__: boolean

declare var __ESM_BUNDLER__: boolean

declare var __FEATURE_PROD_DEVTOOLS__: boolean

declare var __FEATURE_OPTIONS_API__: boolean

declare var __FEATURE_SUSPENSE__: boolean

declare var __VERSION__: string


declare module 'estree-walker' {
    export function walk<T>(
      root: T,
      options: {
        enter?: (node: T, parent: T | undefined) => any
        leave?: (node: T, parent: T | undefined) => any
        exit?: (node: T) => any
      } & ThisType<{ skip: () => void }>
    )
  }


