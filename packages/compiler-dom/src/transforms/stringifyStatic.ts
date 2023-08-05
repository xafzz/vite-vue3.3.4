

/**
 * 
    什么是静态提升(static hoisting)

    <div>
        <div>foo</div> <!-- hoisted -->
        <div>bar</div> <!-- hoisted -->
        <div>{{ dynamic }}</div>
    </div>

    在patch的时候diff操作遇到他们实际上是可以直接跳过的，因为他们都不会变，节点比较过程中它们完全没必要比对
 */

export const stringifyStatic = (children, context, parent) => { 
    console.error(`stringifyStatic`,children, context, parent);
}