import { print } from "@vue/shared";



const filename = 'reativity/effect.ts'


let activeEffectScope: EffectScope | any | undefined

export class EffectScope {
    /**
     * @internal
     */
    private _active = true

    /**
     * only assigned by undetached scope
     * @internal
     */
    parent: EffectScope | undefined

    /**
     * track a child scope's index in its parent's scopes array for optimized
     * removal
     * @internal
     */
    private index: number | undefined
    
    constructor(public detached = false) {
        this.parent = activeEffectScope
        if (!detached && activeEffectScope) {
            this.index =
                (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
                    this
                ) - 1
        }
    }
}

// 记录effect
export function recordEffectScope(
    effect,
    scope
) {
    if (scope && scope.active) {
        console.log(print(filename, 'recordEffectScope', 'scope.effects.push(effect)'), scope);
        scope.effects.push(effect)
    }
}