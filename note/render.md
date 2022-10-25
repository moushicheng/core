# 渲染策略
1. template静态分析后会有动态分析功能，其带来几个好处，
- 一是利用block拍平深层vnode更新，一步到位
- 静态推断更新类型标记PathFlag，尽量在dom patch的过程中略过不必要的更新判断
2. 如果直接使用render来渲染组件，则没有上述好处，因为render极其灵活导致不像template模板一样好静态分析。
3. 二者共通的渲染策略：ShapeFlags，在编译期分析vnode类型，在patch的时候直接进入ShapeFlags相关的分支进行单独处理，比如  
  1. shapeFlag & ShapeFlags.ELEMENT，就会执行  processElement
  2. shapeFlag & ShapeFlags.COMPONENT 就会执行 processComponent

  ## block拍平深层vnode更新
  对于block，我们会有几个基础的问题：
  1. black的数据结构如何？
  2. 怎么收集动态子vnode？
  3. 未来的某个时间，这些收集的动态子节点是如何更新的？

    有两个进阶问题：
  5. 遇到会变动dom结构的块会怎么样？
  6. *动态子节点的patchFlag是如何来的？
  ```javaScript
    const renderWithBlock = (renderChildren: () => VNode[]) => {
    render(
      (openBlock(), (block = createBlock('div', null, renderChildren()))),
      root
    )
  }
  ```
  ### block数据结构
  openBlock会在全局创建一个currentBlock，用于存放当前需要动态更新的节点
  ```javaScript
  function openBlock(disableTracking = false) {
    blockStack.push((currentBlock = disableTracking ? null : []))
  }
  ```
  此后，在createBlock函数中会将当前currentBlock赋予vnode.dynamicChildren，以便后续renderer使用
  ```javascript
  // in createBlock -> setupBlock
  vnode.dynamicChildren =
    isBlockTreeEnabled > 0 ? currentBlock || (EMPTY_ARR as any) : null
  ```
  结论:
  1. block是一个数组，存放动态子节点，并被vnode.dynamicChildren所保存，以便后续使用。

  ### 怎么收集动态子vnode？
  createBlock除了上面说的将当前currentBlock赋予vnode.dynamicChildren，其当然也还要创建vnode了
  ```javascript
  export function createBlock(
    type: VNodeTypes | ClassComponent,
    props?: Record<string, any> | null,
    children?: any,
    patchFlag?: number,
    dynamicProps?: string[]
  ): VNode {
    return setupBlock(
      createVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        true /* isBlock: prevent a block from tracking itself */
      )
    )
  }
  ```

  对于vnode，关于block核心逻辑位于createVnode中
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
  总结：1.根据patchFlag以及相关的一些边界条件判断是否应该加入currentBlack

  ### 动态子节点是如何更新
  聪明的你一定想到了，就是patch的时候看一下有没有dynamicChildren，然后按次序更新呗
  ```javaScript
    const patchBlockChildren: PatchBlockChildrenFn = (
    oldChildren,
    newChildren,
    //省略其他参数
  ) => {
    for (let i = 0; i < newChildren.length; i++) {
      const oldVNode = oldChildren[i]
      const newVNode = newChildren[i]
      // Determine the container (parent element) for the patch.
      const container = //获得container，边界条件非常复杂，暂时不看
      patch(
        oldVNode,
        newVNode,
        container,
      //省略其他参数
      )
    }
  }
  ```
  接下来就是几个比较进阶的问题了
  ### 遇到会变动dom结构的块会怎么样？
  变动dom结构既**结构不稳定**，对于这样的vnode我们应该因地制宜，如下：
  1. v-if 会有多个分支，但只有当前被渲染的分支会被收集到dynamicChildren中，这样会照成下一次更新的时候，不同的tag的vnode会照成一定困扰
  ```html
  <div v-if>{{text}}</div>
  <p v-else>{{text}}</p>
  ```
  比如这里，如果只更新深层的{{text}}，就不会更新标签，其实解决方案很简单，只要将涉及的所有分支都单独设置成一个块即可。源码中也是这么做的

![image-20220830092825166](C:\Users\moush\AppData\Roaming\Typora\typora-user-images\image-20220830092825166.png)

  2. v-for 很容易影响原来vnode结构，会导致单纯遍历更新dynamicChildren，会错失新增dom的更新  

    对于for，我们则直接用传统dom diff即可,在源码中则是给for对应的片段（Fragment）开放绿通道，用传统diff更新children，再更新其上的dynamicChildren（更深层的vnode）
  ### PatchFlag从何而来？
  先复习一下，PatchFlage是block手机动态子节点的***诱因***
  其从而何来？其实是编译器分析模板而来，这归功于模板的静态稳定性。
  具体如下：

## patch行为
根据新旧vnode会有不同的操作，n1是旧vnode，n2是新vnode
首先，如果n1=n2，则直接返回
```typescript
   if (n1 === n2) {
      return
    }
```
如果n1存在，且n2不存在，则直接卸载
```typescript
if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1)
      unmount(n1, parentComponent, parentSuspense, true)
      n1 = null
    }
```
然后根据n2.type执行不同的操作
```typescript
  switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      case Comment:
        processCommentNode(n1, n2, container, anchor)
        break
      case Static:
        if (n1 == null) {
          mountStaticNode(n2, container, anchor, isSVG)
        } else if (__DEV__) {
          patchStaticNode(n1, n2, container, isSVG)
        }
        break
      case Fragment:
        processFragment(n1,n2,container,anchor,parentComponent, parentSuspense, isSVG,slotScopeIds,optimized)
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(//...同processFragment参数)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(//...同processFragment参数)
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          ;(type as typeof TeleportImpl).process(//...同processFragment参数)
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          ;(type as typeof SuspenseImpl).process(//...同processFragment参数)
        } else if (__DEV__) {
          warn('Invalid VNode type:', type, `(${typeof type})`)
        }
```
这里挑典型来说明
首先是processComponent，组件挂载/更新流程
n1不存在，则mountComponent，看情况ShapeFlages来确定是否执行activate
n1存在，则执行patchComponent
```typescript
const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    slotScopeIds: string[] | null,
    optimized: boolean
  ) => {
    n2.slotScopeIds = slotScopeIds
    if (n1 == null) {
      //为keepAlive量身定制的mount，要求该节点已经被缓存
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        ;(parentComponent!.ctx as KeepAliveContext).activate(
          n2,
          container,
          anchor,
          isSVG,
          optimized
        )
      } else {
        mountComponent(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
      }
    } else {
      updateComponent(n1, n2, optimized)
    }
  }
```
对于mountComponent，有以下步骤:
PS：源码有点复杂，就不贴了，这里可以算是一个导读
1. 创建组件实例instance
2. 执行setupComponent(instance) 得到setup返回的render函数,
3. 将render 置入setupRenderEffect中执行
1. setupRenderEffect执行时，将setup.render封装成componentUpdateFn（组件更新函数
2. 组件更新函数componentUpdateFn被放入new ReactiveEffect中执行,此时被“effect”化，渲染函数内部的ref会将ReactiveEffect捕获以便完成数据绑定。
componentUpdateFn详细介绍：
1. 根据vnode.isMounted进行不同处理，如果已经挂载，就更新，没挂载就挂载。
2. 执行renderComponentRoot返回subTree,renderComponentRoot是对render的一层封装，包含一些处理，比如区分组件类型来执行render
3. 利用子树再进行新一轮patch(挂载或者更新)
4. 这里的子树就是div的vnode，后续就是执行div的挂载了，不赘述

对于updateComponent，就更简单了:
组件可更新就执行instance.update函数，否则就直接保持原样
对于instance.update()，实际上就是上面执行的componentUpdate函数。
```typescript
const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
    const instance = (n2.component = n1.component)!
    if (shouldUpdateComponent(n1, n2, optimized)) {
      if (
        __FEATURE_SUSPENSE__ &&
        instance.asyncDep &&
        !instance.asyncResolved
      ) {
        //...
        return
      } else {
        // normal update
        instance.next = n2
        // in case the child component is also queued, remove it to avoid
        // double updating the same child component in the same flush.
        invalidateJob(instance.update)
        // instance.update is the reactive effect.
        instance.update() //在mountComponent，定义了该函数
      }
    } else {
      // no update needed. just copy over properties
      n2.el = n1.el
      instance.vnode = n2
    }
  }
```
## ShapeFlages如何而来？
刚刚说了ShapeFlages,那你肯定会好奇ShapeFlages是怎么被vue分析出来的,其实直接看看createVnode就好了

### 现象
```Vue
<template>
  <Comp></Comp>
</template>
```
这样的一个template模板
最终会被编译成
```javascript 
const __sfc__ = {}
import { resolveComponent as _resolveComponent, openBlock as _openBlock, createBlock as _createBlock } from "vue"
function render(_ctx, _cache) {
  const _component_Comp = _resolveComponent("Comp")

  return (_openBlock(), _createBlock(_component_Comp))
}
__sfc__.render = render
__sfc__.__file = "App.vue"
export default __sfc__
```
### 创建vnode
createBlack就是创建Vnode的那个函数，其生成shapeFlag的核心逻辑如下，
完全就是根据type来决定ShapeFlag嘛！
```javascript
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
    ? ShapeFlags.SUSPENSE
    : isTeleport(type)
    ? ShapeFlags.TELEPORT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT
    : 0
```