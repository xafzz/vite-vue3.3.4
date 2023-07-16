
// 合并对象
export const extend = Object.assign

// object
export const isObject = (val: unknown): val is Record<any, any> => val !== null && typeof val === 'object'

export const isString = (val: unknown): val is string => typeof val === 'string'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'


export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

// 静态方法确定两个值是否为相同值
export const hasChanged = (value, oldValue) => !Object.is(value,oldValue)

// 始终是false
export const NO = () => false

export const isArray = Array.isArray


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

export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1)
}


const hasOwnProperty = Object.prototype.hasOwnProperty
export const  hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

