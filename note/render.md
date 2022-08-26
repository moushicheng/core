组件挂载流程

1.父组件更新，子组件会更新吗（子组件并不需要更新的情况下）？
- 结论1：会patch新旧子组件的vnode
- 结论2：新旧子组件patch会被shouldUpdateComponent截断，避免重复渲染
对于shouldUpdateComponent
- 结论1，如果子组件有 directive or transition则返回true
- 结论2, 子组件的dynamicChildren存在
  - 判断PatchFlag.DYNAMIC_SLOTS，直接返回true
  - PatchFlags.FULL_PROPS，进一步判断
  - PatchFlags.PROPS，进一步判断
- 结论3， 子组件的dynamicChildren不存在(只有手动编写render会进入此分支),
  - 比较新旧子vnode上的children是否存在$table，存在则返回true
  - 然后，比较props是否需要更新，如果需要则返回true，不需要则返回false
