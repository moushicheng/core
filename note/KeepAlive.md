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
const subTree = (instance.subTree = renderComponentRoot(instance)) //会调用App.render
//将KeepAlive组件实例挂载到root上
patch(null, subTree, container, anchor, instance, parentSuspense, isSVG)
```

5. KeepAlive 与一般组件挂载实例流程无差别遵照一般组件挂载流程理解即可
6. 挂载的过程中会先执行 KeepAlive 的 setup 获取 render
7. 然后与 3 相同，KeepAlive.render 的会被封装成 componentUpdateFn 然后丢到 reactiveEffect 内部执行，以此使 render 被相关 ref 捕获

## KeepAlive setup&render

### render

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



1. 问题1：为啥keepAlive不应该缓存非组件节点？
第一:keepAlive在编译器就会进行初步检测
第二：从keepAlive实现上来说，因为缓存的Map的key是vnode.type，而如果是普通节点key就无法保证唯一性，比如div,p这类元素节点