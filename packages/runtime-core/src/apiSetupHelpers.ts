import { isArray } from "@vue/shared";

/**
 * @internal
 */
export function normalizePropsOrEmits(
  props: any
) {
  return isArray(props)
    ? props.reduce(
        (normalized, p) => ((normalized[p] = null), normalized),
        {} as any 
      )
    : props
}