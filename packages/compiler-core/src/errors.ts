

export function defaultOnError(error) {
    throw error
}

export function defaultOnWarn(msg) {
    __DEV__ && console.warn(`[Vue warn] ${msg.message}`)
}