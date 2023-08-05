import { NodeTypes, ElementTypes } from '@vue/compiler-core'
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

// script和style都算是副作用标签，是需要过滤掉（remove）
// sfc 模式下 也会走着
export const ignoreSideEffectTags = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    (node.tag === 'script' || node.tag === 'style')
  ) {
    // 因为直接将整个.vue 内容拿出来 template、script
    // __DEV__ &&
    //   context.onError(
    //     createDOMCompilerError(
    //       DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
    //       node.loc
    //     )
    // )
    // 过滤掉
    context.removeNode()
  }
}
