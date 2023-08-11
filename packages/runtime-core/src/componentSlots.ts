import { ShapeFlags, def } from "@vue/shared";
import { InternalObjectKey } from "./vnode";




// 初始化slots
export const initSlots = (
  instance: any,
  children: any
) => {
  // 如果shapFlags补丁是slots
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
      console.error(`initSlots`,1);
  } else {
    instance.slots = {}
    if (children) {
      console.error(`initSlots`,2);
    }
  }
  def(instance.slots, InternalObjectKey, 1)
}