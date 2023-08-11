
/**
 * @param ELEMENT 1 , HTML SVG 或普通DOM元素
 * @param FUNCTIONAL_COMPONENT 2 , 无状态组件/函数式组件
 * @param STATEFUL_COMPONENT 4 ,有状态组件/对象
 * @param TEXT_CHILDREN 8 , 子节点为纯文本
 * @param ARRAY_CHILDREN 16 , 子节点是数组
 * @param SLOTS_CHILDREN 32 , 子节点包含插槽
 * @param TELEPORT 64 , Teleport
 * @param SUSPENSE 128 , suspense
 * @param COMPONENT_SHOULD_KEEP_ALIVE 256 ,keepAlive
 * @param COMPONENT_KEPT_ALIVE 512 , 
 * @param COMPONENT 6 , 
 */
export const enum ShapeFlags {
  ELEMENT = 1,//HTML SVG 或普通DOM元素
  FUNCTIONAL_COMPONENT = 1 << 1, //无状态组件/函数式组件 2
  STATEFUL_COMPONENT = 1 << 2, //有状态组件/对象 4 
  TEXT_CHILDREN = 1 << 3, //子节点为纯文本 8
  ARRAY_CHILDREN = 1 << 4,   //子节点是数组 16
  SLOTS_CHILDREN = 1 << 5,  //子节点包含插槽 32
  TELEPORT = 1 << 6, // Teleport 64
  SUSPENSE = 1 << 7, //suspense 128
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, //keepAlive 256
  COMPONENT_KEPT_ALIVE = 1 << 9,  // 512
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT // 6
}
