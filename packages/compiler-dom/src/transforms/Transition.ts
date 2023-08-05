import { ElementTypes, NodeTypes } from "@vue/compiler-core";




// <Transition>
export const transformTransition = (node, context) => { 

    if (
        node.type === NodeTypes.ELEMENT &&
        node.tagType === ElementTypes.COMPONENT
    ) { 
        console.error(`transformStyle`,node, context);
    }
}