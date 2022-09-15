首先先看看directive的基本结构
```typescript
    const Comp = {
      setup() {
        _instance = currentInstance
      },
      render() {
        _prevVnode = _vnode
        _vnode = withDirectives(h('div', count.value), [
          [
            dir,
            // value
            count.value,
            // argument
            'foo',
            // modifiers
            { ok: true }
          ] //这是一个directive
        ])
        return _vnode
      }
    }
```
关于withDirectives，其实withXXXX在vue中的作用基本都是做些前处理，这里就是vnode.dirs=[directive...]
其实指令，就是一个适当激活钩子的生命周期集合
比如对于激活created钩子，我们在mountElement函数中可以发现端倪
```typescript
//其中的一句
if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'created')
}
```
接下来看看invokeDirectiveHook做了什么
0.前处理，比如查找旧value
1.查找钩子
2.执行钩子
```typescript
function invokeDirectiveHook(
  vnode: VNode,
  prevVNode: VNode | null,
  instance: ComponentInternalInstance | null,
  name: keyof ObjectDirective
) {
  const bindings = vnode.dirs!
  const oldBindings = prevVNode && prevVNode.dirs!
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value
    }
    let hook = binding.dir[name] as DirectiveHook | DirectiveHook[] | undefined
    if (__COMPAT__ && !hook) {
      hook = mapCompatDirectiveHook(name, binding.dir, instance)
    }
    if (hook) {
      // disable tracking inside all lifecycle hooks
      // since they can potentially be called inside effects.
      pauseTracking()
      callWithAsyncErrorHandling(hook, instance, ErrorCodes.DIRECTIVE_HOOK, [
        vnode.el,
        binding,
        vnode,
        prevVNode
      ])
      resetTracking()
    }
  }
```
剩下的工作就是看看这些dirs生命周期钩子都在哪里被call了
created && beforeMounted && mounted
```typescript
      if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(el, vnode.children as string)
      } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        mountChildren(
          vnode.children as VNodeArrayChildren,
          el,
          null,
          parentComponent,
          parentSuspense,
          isSVG && type !== 'foreignObject',
          slotScopeIds,
          optimized
        )
      }
    if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'created') //在挂载完子节点之后
    }
 
   //...

    if (dirs) {
      invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')//在insert之前
    }

    hostInsert(el, container, anchor) 
      if (
      (vnodeHook = props && props.onVnodeMounted) ||
      needCallTransitionHooks ||
      dirs
    ) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode)
        needCallTransitionHooks && transition!.enter(el)
        dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted') //在渲染完成之后异步调用mounted
      }, parentSuspense)
    }
```