
export const TELEPORT = Symbol(__DEV__ ? `Teleport` : ``)
export const SUSPENSE = Symbol(__DEV__ ? `Suspense` : ``)
export const KEEP_ALIVE = Symbol(__DEV__ ? `KeepAlive` : ``)
export const BASE_TRANSITION = Symbol(__DEV__ ? `BaseTransition` : ``)

//需要从中的“vue”导入的运行时帮助程序的名称映射
//生成的代码。请确保在运行时正确导出这些内容！
export const helperNameMap: Record<symbol, string> = {
  [TELEPORT]: `Teleport`,
  [SUSPENSE]: `Suspense`,
  [KEEP_ALIVE]: `KeepAlive`,
  [BASE_TRANSITION]: `BaseTransition`,
}