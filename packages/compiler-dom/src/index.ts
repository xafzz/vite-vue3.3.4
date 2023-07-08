
import { extend, print } from "@vue/shared"
import { baseParse } from "@vue/compiler-core"
import { parserOptions } from "./parserOptions"

const currentFilename = 'compiler-dom/index.ts'

export function parse(template: string, options: any = {}) {
    console.log(print(currentFilename,'parse()'), template)

    return baseParse(
        template,
        extend(
            {},
            parserOptions,
            options
        )
    )
}