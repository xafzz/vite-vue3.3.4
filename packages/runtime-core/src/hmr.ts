import { isClassComponent } from "./component"




export let isHmrUpdating = false


export const hmrDirtyComponents = new Set()




const map: Map<
  string,
  {
    // the initial component definition is recorded on import - this allows us
    // to apply hot updates to the component even when there are no actively
    // rendered instance.
    initialDef: any
    instances: Set<any>
  }
    > = new Map()

    // 注册热更新
export function registerHMR(instance: any) {
    const id = instance.type.__hmrId!
    let record = map.get(id)
    if (!record) {
      createRecord(id, instance.type as any)
      record = map.get(id)!
    }
    record.instances.add(instance)
}
  

function createRecord(id: string, initialDef: any): boolean {
    if (map.has(id)) {
      return false
    }
    map.set(id, {
      initialDef: normalizeClassComponent(initialDef),
      instances: new Set()
    })
    return true
}
  

function normalizeClassComponent(component: any): any {
    return isClassComponent(component) ? component.__vccOpts : component
  }
  