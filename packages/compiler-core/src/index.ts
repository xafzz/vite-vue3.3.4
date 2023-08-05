export { baseParse,TextModes } from "./parse";
export { baseCompile } from './compile'

export {
  ErrorCodes,
  createCompilerError
} from './errors'

export * from './ast'
export * from './utils'
export * from './runtimeHelpers'


export { transformOn } from './transforms/vOn'


// v2 compat only
export {
  checkCompatEnabled,
  warnDeprecation,
  CompilerDeprecationTypes
} from './compat/compatConfig'