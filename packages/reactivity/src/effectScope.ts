import { print } from "@vue/shared";



const filename = 'reativity/effect.ts'



export class EffectScope { 
    
}

// 记录effect
export function recordEffectScope(
    effect,
    scope
) { 
    if (scope && scope.active) { 
        console.log(print(filename, 'recordEffectScope','scope.effects.push(effect)'), scope);
        scope.effects.push(effect)
    }
}