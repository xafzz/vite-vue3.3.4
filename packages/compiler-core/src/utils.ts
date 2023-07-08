
// 搞个断言？
export function assert(condition: boolean, msg?: string) {
    if (!condition) {
        throw new Error(msg || `意外的编译器条件`)
    }
}