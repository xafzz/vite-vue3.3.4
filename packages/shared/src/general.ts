
// 合并对象
export const extend = Object.assign

// 始终是false
export const NO = () => false


const cacheStringFunction =(fn) => {
    const cache: Record<string, string> = Object.create(null)
    return ((str: string) => {
      const hit = cache[str]
      return hit || (cache[str] = fn(str))
    }) 
  }

const hyphenateRE = /\B([A-Z])/g
/**
 * @private
 */
export const hyphenate = cacheStringFunction((str: string) =>
  str.replace(hyphenateRE, '-$1').toLowerCase()
)