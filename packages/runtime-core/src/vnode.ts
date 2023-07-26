import { print } from "@vue/shared"



const filename = 'runtime-core/vnode.ts'

const createVNodeWithArgsTransform = (...args) => {

}

export const createVNode = __DEV__ ? createVNodeWithArgsTransform : _createVNode


function _createVNode(
    type,
    props: null = null,
    children: unknown = null,
    patchFlag: number = 0,
    dynamicProps: string[] | null = null,
    isBlockNode = false
) {

    console.log(print(filename,'_createVNode'))
}