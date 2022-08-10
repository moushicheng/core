```javascript
 function defineAsyncComponent<T extends ComponentOptions>(
    comp: T,
    delay: number = 0
  ) {
    return {
      setup(props: any, { slots }: any) {
        const p = new Promise(resolve => {
          setTimeout(() => {
            resolve(() => h(comp, props, slots))
          }, delay)
        })
        // in Node 12, due to timer/nextTick mechanism change, we have to wait
        // an extra tick to avoid race conditions
        deps.push(p)
        return p
      }
    }
  }

  const Async = defineAsyncComponent({
      render() {
        return h('div', 'async')
      }
    })

    const Comp = {
      setup() {
        return () =>
          h(Suspense, null, {
            default: h(Async),
            fallback: h('div', 'fallback')
          })
      }
    }

    const root = nodeOps.createElement('div')
    render(h(Comp), root)
```
1. 在挂载时根据 type:ShapeFlags.SUSPENSE 转而执行 Suspense 组件上的 process 方法
2. process -> mountSuspense
3. mountSuspense 注册了 suspense 边界对象然后对 vnode.ssContent 进行了 patch ,源码如下↓

```javascript
//in mountSuspense
//suspense是一组信息集合，拥有suspense的一些必要信息和核心方法
 const suspense = (vnode.suspense = createSuspenseBoundary(
    vnode,
    parentSuspense,
    parentComponent,
    container,
    hiddenContainer,
    anchor,
    isSVG,
    slotScopeIds,
    optimized,
    rendererInternals
  ))
//ssContent是default选项的vnode对象，在上面是h(Async)
patch(
    null,
    (suspense.pendingBranch = vnode.ssContent!),
    hiddenContainer,
    null,
    parentComponent,
    suspense,
    isSVG,
    slotScopeIds
  )
```
4. 在patch的过程中会执行Async.setup，其内部返回了一个promise，会经过特殊处理。
