```javascript
test('should preserve state', async () => {
    const viewRef = ref('one')
    const instanceRef = ref<any>(null)
    const App = {
      //render会被丢到reactiveEffect内部执行，以此使render被其内部的ref数据捕获
      render() {
        return h(KeepAlive, null, {
          default: () => h(views[viewRef.value], { ref: instanceRef })
        })
      }
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>one</div>`)
```

APP 是一个大组件，其中 render 返回的 KeepAlive 实例是小组件，以上 render 流程会有两次挂载。
以上的流程是

1.  h(App)获得 App 的 vnode 对象
2.  然后把 vnode(App)交由 render 函数挂载到 root 上
3.  挂载的过程中,APP.render 的会被封装成 componentUpdateFn 然后丢到 reactiveEffect 内部执行，以此使 render 被相关 ref 捕获
4.  而 APP.render 返回的 KeepAlive vnode 会在 componentUpdateFn 内继续 patch

```javascript
const subTree = (instance.subTree = renderComponentRoot(instance)) //会调用App.render，这里是缓存vnode关键的
//将KeepAlive组件实例挂载到root上
patch(null, subTree, container, anchor, instance, parentSuspense, isSVG)
```

5. KeepAlive 挂载组件时 先从缓存中获取subTree（旧vnode），没有就执行一遍render然后再缓存
6. 然后再patch


### render的细节

1. 获取当前挂载元素，通过 slots.default
2. 通过 name 来筛选|排除不用缓存的组件

```javascript
  const name = getComponentName(
        isAsyncWrapper(vnode)
          ? (vnode.type as ComponentOptions).__asyncResolved || {}
          : comp
      )
      const { include, exclude, max } = props

      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        current = vnode
        return rawVNode
      }

      const key =
```

3. 通过 key 从缓存中获取组件

```javascript
const key = vnode.key == null ? comp : vnode.key
const cachedVNode = cache.get(key)
```

4. 如果组件存在，就返回缓存组件但还有几个重要的逻辑

```javaScript
//设置缓存
        vnode.el = cachedVNode.el
        vnode.component = cachedVNode.component
        // avoid vnode being mounted as fresh 挂载时不是真的挂载，通过shapeFlag标识避开挂载转而执行active函数
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
```

5. 若不存在，就设置缓存

```javascript
keys.add(key)
```

6. 最后返回

```javascript
// avoid vnode being unmounted 用来unmounted的时候触发deActive方法而不是真的卸载
vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
return isSuspense(rawVNode.type) ? rawVNode : vnode
```

### keepAlive的挂载流程
如果一个子节点有缓存，那么它的shapeFlags就会被打上COMPONENT_KEPT_ALIVE的标记
在挂载组件时则会执行
```javascript
 if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        ;(parentComponent!.ctx as KeepAliveContext).activate(
          n2,
          container,
          anchor,
          isSVG,
          optimized
        )
```
看一眼就懂了吧，先将隐藏容器中的缓存dom节点移入真实容器，然后再重新patch（可能会有更新
```javascript
    sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
      const instance = vnode.component!
      move(vnode, container, anchor, MoveType.ENTER, parentSuspense) //将vnode.el移入container，container是真实容器
      // in case props have changed
      patch(
        instance.vnode,
        vnode,
        container,
        anchor,
        instance,
        parentSuspense,
        isSVG,
        vnode.slotScopeIds,
        optimized
      )
```
同时，如果是unmounted，就将dom移入隐藏容器，方便未来使用
```typescript
 sharedContext.deactivate = (vnode: VNode) => {
      const instance = vnode.component!
      move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)
      queuePostRenderEffect(() => {
        if (instance.da) {
          invokeArrayFns(instance.da)
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode)
        }
        instance.isDeactivated = true
      }, parentSuspense)

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        // Update components tree
        devtoolsComponentAdded(instance)
      }
    }
```
但是无论怎样移入，都不会改变缓存中vnode.el对dom的指向，也就是说未来通过cache获取到的vnode节点依然可以随便使用，这很灵活。

1. 问题1：为啥keepAlive不应该缓存非组件节点？
第一: keepAlive在编译期就会进行初步检测，如果他的子节点不是组件就会报错
第二：从keepAlive实现上来说，因为缓存的Map的key是vnode.type，而如果是普通节点key就无法保证唯一性，比如div,p这类元素节点
