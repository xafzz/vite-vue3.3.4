import { isArray } from "@vue/shared"
import { queuePostFlushCb } from "../scheduler"





export const isSuspense = (type: any): boolean => type.__isSuspense


export function queueEffectWithSuspense(
    fn: Function | Function[],
    suspense: any | null
  ): void {
    if (suspense && suspense.pendingBranch) {
      if (isArray(fn)) {
        suspense.effects.push(...fn)
      } else {
        suspense.effects.push(fn)
      }
    } else {
      queuePostFlushCb(fn)
    }
  }