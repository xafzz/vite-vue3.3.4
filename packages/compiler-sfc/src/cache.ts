import { print } from '@vue/shared';
import { LRUCache } from 'lru-cache'

const currentFilename = 'compiler-sfc/cache.ts'

export function createCache(size = 500000) {

    console.log(print(currentFilename, 'createCache(),放到外面先执行,提到parse里面了'));

    const options = {
        max: size,
        maxSize: 5000000,
        sizeCalculation: (value, key) => {
            return 1
        },
    }
    const cache = new LRUCache(options)

    return cache as any
}
