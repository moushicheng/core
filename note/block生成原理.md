! important
issue:
https://github.com/vuejs/core/issues/6913
fix:
https://github.com/vuejs/core/pull/7085/commits/dd67a6fe343afb642710c2fe59c9421cf6aa5173#

1. createCodegenNodeForBranch 返回的数据结构中的index代表什么意思？

   用于代码生成阶段_cache[index]块的生成，使v-if不会被追踪。

2. setBlockTracking设置的 isBlockTreeEnabled += value 是如何禁止追踪block的？
```javaScript
 // track vnode for block tree
if (
  isBlockTreeEnabled > 0 &&
  !isBlockNode &&
  currentBlock &&

  (vnode.patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
  vnode.patchFlag !== PatchFlags.HYDRATE_EVENTS
) {
  currentBlock.push(vnode)
}
```
看这，isBlockTreeEnabled为正时才会追踪数据,其默认值为1


3. 修复： !context.inSSR && push(`,${helper(SET_BLOCK_TRACKING)}(1),_cache[${node.index!}])`)，看得出使用了setBlockTracking来禁止block，但后面的_cache是什么意思？

   cache是这样配套使用的，在这种情况下，createVnode不会被追踪。且最后要_cache[1]是为了在表达式(1,2,3,_cache)返回cache的结果

```js
**
 * Block tracking sometimes needs to be disabled, for example during the
 * creation of a tree that needs to be cached by v-once. The compiler generates
 * code like this:
 *
 * ``` js
 * _cache[1] || (
 *   setBlockTracking(-1),
 *   _cache[1] = createVNode(...),
 *   setBlockTracking(1),
 *   _cache[1]
 * )
 * ```
 *
 * @private
 */
```

