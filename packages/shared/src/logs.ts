let logsNumber: number = __NUMBER__

export function logsFn() {
    return function (filename: string = '', content: any, param = []) {
        return [
            `\x1b[40;31m ${logsNumber++} \x1b[0m , \x1b[33m${filename}\x1b[0m\n`,
            `\x1b[32m ${content} \x1b[0m\n`,
            ...param
        ].join('')
    }
}

export const print = logsFn()