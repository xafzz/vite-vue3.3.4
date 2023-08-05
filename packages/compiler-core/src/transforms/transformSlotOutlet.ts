import { isSlotOutlet } from "../utils";


export const transformSlotOutlet = (node, context) => {

  if (isSlotOutlet(node)) { 
    console.error(`transformSlotOutlet`,node, context);
  }
}
