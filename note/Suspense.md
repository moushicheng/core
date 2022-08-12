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
3. mountSuspense 注册了 suspense 边界对象然后对 vnode.ssContent 进行了 patch ,源码如下 ↓

```javascript
//in mountSuspense
//suspense是一组信息集合，拥有suspense的一些必要信息和核心方法
 const suspense = (vnode.suspense = createSuspenseBoundary(vnode,parentSuspense,parentComponent,container,hiddenContainer,anchor,isSVG,slotScopeIds,
   optimized,rendererInternals
  ))
//ssContent是default选项的vnode对象，在上面是h(Async)
patch(null,(suspense.pendingBranch = vnode.ssContent!),hiddenContainer,null,parentComponent,suspense,isSVG,slotScopeIds)
//假patch完default后会真patch fallback
 if (suspense.deps > 0) {
    // has async
    // invoke @fallback event
    triggerEvent(vnode, 'onPending')
    triggerEvent(vnode, 'onFallback')

    // mount the fallback tree
    patch(null,vnode.ssFallback!,container,anchor,parentComponent,null, slotScopeIds)
    setActiveBranch(suspense, vnode.ssFallback!)
  }
```

顺便，再认识一下suspense对象
```javascript
interface SuspenseBoundary {
  vnode: VNode<RendererNode, RendererElement, SuspenseProps>
  parent: SuspenseBoundary | null
  parentComponent: ComponentInternalInstance | null
  isSVG: boolean
  container: RendererElement   //实际dom容器
  hiddenContainer: RendererElement //内存中的隐藏dom容器
  anchor: RendererNode | null   
  activeBranch: VNode | null   //当前suspense正在激活的实例，比如最开始激活的总是fallback
  pendingBranch: VNode | null  //正在pending的vnode，比如最开始总是pending的是default中的异步组件
  deps: number
  pendingId: number
  timeout: number
  isInFallback: boolean //表示是否正在Fallback阶段
  isHydrating: boolean  //ssr相关
  isUnmounted: boolean
  effects: Function[]
  resolve(force?: boolean): void
  fallback(fallbackVNode: VNode): void
  move(
    container: RendererElement,
    anchor: RendererNode | null,
    type: MoveType
  ): void
  next(): RendererNode | null
  registerDep(
    instance: ComponentInternalInstance,
    setupRenderEffect: SetupRenderEffectFn
  ): void
  unmount(parentSuspense: SuspenseBoundary | null, doRemove?: boolean): void
}
```


4. 在 patch 的过程中会执行 Async.setup，其内部返回了一个 promise，会经过特殊处理,实际上就是打上了回调处理方法

```javascript
if (isPromise(setupResult)) {
  setupResult.then(unsetCurrentInstance, unsetCurrentInstance)
  instance.asyncDep = setupResult //将当前promise的执行链植入asyncDep属性
} else {
  //...省略
}
```

5. 在 setup 执行完后，会有一段 Suspense 独有的逻辑，这里刚好截断了后续的渲染（防止 default 被渲染上去）default 要等 resolve 后再渲染才行。

```javascript
    if (__FEATURE_SUSPENSE__ && instance.asyncDep) {
      //在suspense上注册async.instance和它的render函数(setupRenderEffect就是对render的封装)
      parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect)

      // Give it a placeholder if this is not hydration
      // TODO handle self-defined fallback
      if (!initialVNode.el) {
        const placeholder = (instance.subTree = createVNode(Comment))
        processCommentNode(null, placeholder, container!, anchor)
      }
      return
    }
```

6. 展开注册 registerDep 函数,发现它做了两件事，第一增加 deps 统计数，第二在 promise 执行链上增加一段后处理逻辑

```javascript
registerDep(instance, setupRenderEffect){
      suspense.deps++;
      const hydratedEl = instance.vnode.el;
      instance
        .asyncDep!.catch(err => {
          handleError(err, instance, ErrorCodes.SETUP_FUNCTION)
        })
        .then(asyncSetupResult => {
        //核心逻辑,当promise resolve后重启真正的渲染逻辑
        instance.render = setupResult as InternalRenderFunction //处理render，实际上是render=() => h(comp, props, slots)（default异步组件的渲染函数）

        setupRenderEffect(...) //执行真正的render逻辑，
        })
    },
```

## 总结一下 default 的渲染逻辑:

1. 在 suspense 组件挂载的时候，执行 suspense.process 方法，而不是走正常的组件挂载逻辑
2. 然后在 process 内部会挂载 default
3. default.setup 返回了一个 Promise 会被 vue 存储下来，然后后续真正的 dom 挂载会被截断。
4. 然后 Promise 作用链会被打上各种方法，比如错误处理(ErrorCodes.SETUP_FUNCTION)和核心渲染（在 promise 链最尾端执行 render）
5. 完成第一步 default patch 之后会进行 fallback patch

## suspense patch 逻辑

```javaScript
      patchSuspense(
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        isSVG,
        slotScopeIds,
        optimized,
        rendererInternals
      )
```
