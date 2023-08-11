
const stack: any[] = []

export function pushWarningContext(vnode: any) {
  stack.push(vnode)
}

export function popWarningContext() {
  stack.pop()
}
