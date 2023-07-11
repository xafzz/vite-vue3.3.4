
import { extend, print } from "@vue/shared"
import { baseParse } from "@vue/compiler-core"
import { parserOptions } from "./parserOptions"

const currentFilename = 'compiler-dom/index.ts'

export function parse(template: string, options: any = {}) {

    const result = baseParse(
        template,
        extend(
            {},
            parserOptions,
            options
        )
    )
    console.log(print(currentFilename,'compoiler-dem-parse()'), result)
    return result
}