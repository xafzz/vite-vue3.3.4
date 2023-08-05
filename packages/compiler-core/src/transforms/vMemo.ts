import { NodeTypes } from "../ast";
import { findDir } from "../utils";


const seen = new WeakSet()

export const transformMemo = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    // v-memo
    const dir = findDir(node, 'memo')
    if (!dir || seen.has(node)) {
      return
    }

    console.error(`transformMemo`, node, context);
  }
}
