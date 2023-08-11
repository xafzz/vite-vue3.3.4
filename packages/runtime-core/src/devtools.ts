

export function setDevtoolsHook(hook, target) {

}

const enum DevtoolsHooks {
    APP_INIT = 'app:init',
    APP_UNMOUNT = 'app:unmount',
    COMPONENT_UPDATED = 'component:updated',
    COMPONENT_ADDED = 'component:added',
    COMPONENT_REMOVED = 'component:removed',
    COMPONENT_EMIT = 'component:emit',
    PERFORMANCE_START = 'perf:start',
    PERFORMANCE_END = 'perf:end'
}

interface DevtoolsHook {
    enabled?: boolean
    emit: (event: string, ...payload: any[]) => void
    on: (event: string, handler: Function) => void
    once: (event: string, handler: Function) => void
    off: (event: string, handler: Function) => void
    appRecords: any[]
    /**
     * Added at https://github.com/vuejs/devtools/commit/f2ad51eea789006ab66942e5a27c0f0986a257f9
     * Returns wether the arg was buffered or not
     */
    cleanupBuffer?: (matchArg: unknown) => boolean
}

export let devtools: DevtoolsHook

let buffer: { event: string; args: any[] }[] = []

let devtoolsNotInstalled = false

function emit(event: string, ...args: any[]) {
    if (devtools) {
        devtools.emit(event, ...args)
    } else if (!devtoolsNotInstalled) {
        buffer.push({ event, args })
    }
}

export const devtoolsPerfStart = /*#__PURE__*/ createDevtoolsPerformanceHook(
    DevtoolsHooks.PERFORMANCE_START
)

export const devtoolsPerfEnd = /*#__PURE__*/ createDevtoolsPerformanceHook(
    DevtoolsHooks.PERFORMANCE_END
)



function createDevtoolsPerformanceHook(hook: DevtoolsHooks) {
    return (component: any, type: string, time: number) => {
        emit(hook, component.appContext.app, component.uid, component, type, time)
    }
}
