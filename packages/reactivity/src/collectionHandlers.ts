

const filename = 'reativity/collectionHandlers.ts'


function createInstrumentationGetter(isReadonly :boolean,shallow:boolean) { 

}

export const mutableCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(false,false)
}

export const shallowCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(false,true)
}

export const readyonlyCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(true,false)
}

export const shallowReadonlyCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(true,true)
}