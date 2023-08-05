import { NodeTypes } from "../ast";
import { findDir } from "../utils";


export const transformOnce = (node, context) => {
  if (node.type === NodeTypes.ELEMENT && findDir(node, 'once', true)) { 
    console.error(`transformOnce`,node, context);
  }
}
