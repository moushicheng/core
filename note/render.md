# 渲染策略

1. template 静态分析后会有动态分析功能，其带来几个好处，

- 一是利用 block 拍平深层 vnode 更新，一步到位
- 静态推断更新类型标记 PathFlag，尽量在 dom patch 的过程中略过不必要的更新判断,PatchFlag 会靶向标记应该更新的地方。

2. 如果直接使用 render 来渲染组件，则没有上述好处，因为 render 极其灵活导致不像 template 模板一样好静态分析。
3. 二者共通的渲染策略：ShapeFlags，在运行时根据 type 分析 vnode 类型，在 patch 的时候直接进入 ShapeFlags 相关的分支进行单独处理，比如
4. shapeFlag & ShapeFlags.ELEMENT，就会执行 processElement
5. shapeFlag & ShapeFlags.COMPONENT 就会执行 processComponent

## block 拍平深层 vnode 更新

对于 block，我们会有几个基础的问题：

1. black 的数据结构如何？
2. 怎么收集动态子 vnode？
3. 未来的某个时间，这些收集的动态子节点是如何更新的？


    有两个进阶问题：

5. 遇到会变动 dom 结构的块会怎么样？
6. 动态子节点的 patchFlag 是如何来的？

```javaScript
  const renderWithBlock = (renderChildren: () => VNode[]) => {
  render(
    (openBlock(), (block = createBlock('div', null, renderChildren()))),
    root
  )
}
```

### block 数据结构

openBlock 会在全局创建一个 currentBlock，用于存放当前需要动态更新的节点

```javaScript
function openBlock(disableTracking = false) {
  blockStack.push((currentBlock = disableTracking ? null : []))
}
```

此后，在 createBlock 函数中会将当前 currentBlock 赋予 vnode.dynamicChildren，以便后续 renderer 使用

```javascript
// in createBlock -> setupBlock
vnode.dynamicChildren =
  isBlockTreeEnabled > 0 ? currentBlock || (EMPTY_ARR as any) : null
```

结论:

1. block 是一个数组，存放动态子节点，并被 vnode.dynamicChildren 所保存，以便后续使用。

### 怎么收集动态子 vnode？

createBlock 除了上面说的将当前 currentBlock 赋予 vnode.dynamicChildren，其当然也还要创建 vnode 了

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

对于 vnode，关于 block 核心逻辑位于 createVnode 中

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

总结：1.根据 patchFlag 以及相关的一些边界条件判断是否应该加入 currentBlack

### 动态子节点是如何更新

聪明的你一定想到了，就是 patch 的时候看一下有没有 dynamicChildren，然后按次序更新呗

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

### 遇到会变动 dom 结构的块会怎么样？

变动 dom 结构既**结构不稳定**，对于这样的 vnode 我们应该因地制宜，如下：

1. v-if 会有多个分支，但只有当前被渲染的分支会被收集到 dynamicChildren 中，这样会照成下一次更新的时候，不同的 tag 的 vnode 会照成一定困扰

```html
<div v-if>{{text}}</div>
<p v-else>{{text}}</p>
```

比如这里，如果只更新深层的{{text}}，就不会更新标签，其实解决方案很简单，只要将涉及的所有分支都单独设置成一个块即可。源码中也是这么做的

![image-20220830092825166](C:\Users\moush\AppData\Roaming\Typora\typora-user-images\image-20220830092825166.png)

2. v-for 很容易影响原来 vnode 结构，会导致单纯遍历更新 dynamicChildren，会错失新增 dom 的更新


    对于for，我们则直接用传统dom diff即可,在源码中则是给for对应的片段（Fragment）开放绿通道，用传统diff更新children，再更新其上的dynamicChildren（更深层的vnode）

### PatchFlag 从何而来？

先复习一下，PatchFlage 是 block 收集动态子节点的**_诱因_**
其从而何来？其实是编译器分析模板而来，这归功于模板的静态稳定性。
具体如下：
PatchFlag完全由编译期分析而来，
其分析阶段来源于
transform阶段：此时HTML AST已生成，编译器在transform阶段优化AST，
比如说 v-xxx这种指令会在AST中以attribute的形式存在，但明显，它们不是普通属性，要经过优化处理。


## patch 行为

根据新旧 vnode 会有不同的操作，n1 是旧 vnode，n2 是新 vnode
首先，如果 n1=n2，则直接返回

```typescript
if (n1 === n2) {
  return
}
```

如果 n1 存在，且 n2 不存在，则直接卸载

```typescript
if (n1 && !isSameVNodeType(n1, n2)) {
  anchor = getNextHostNode(n1)
  unmount(n1, parentComponent, parentSuspense, true)
  n1 = null
}
```

然后根据 n2.type 执行不同的操作

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
首先是 processComponent，组件挂载/更新流程
n1 不存在，则 mountComponent，看情况 ShapeFlages 来确定是否执行 activate
n1 存在，则执行 patchComponent

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

对于 mountComponent，有以下步骤:
PS：源码有点复杂，就不贴了，这里可以算是一个导读

1. 创建组件实例 instance
2. 执行 setupComponent(instance) 得到 setup 返回的 render 函数,
3. 将 render 置入 setupRenderEffect 中执行
4. setupRenderEffect 执行时，将 setup.render 封装成 componentUpdateFn（组件更新函数
5. 组件更新函数 componentUpdateFn 被放入 new ReactiveEffect 中执行,此时被“effect”化，渲染函数内部的 ref 会将 ReactiveEffect 捕获以便完成数据绑定。
   componentUpdateFn 详细介绍：
6. 根据 vnode.isMounted 进行不同处理，如果已经挂载，就更新，没挂载就挂载。
7. 执行 renderComponentRoot 返回 subTree,renderComponentRoot 是对 render 的一层封装，包含一些处理，比如区分组件类型来执行 render
8. 利用子树再进行新一轮 patch(挂载或者更新)
9. 这里的子树就是 div 的 vnode，后续就是执行 div 的挂载了，不赘述

对于 updateComponent，就更简单了:
组件可更新就执行 instance.update 函数，否则就直接保持原样
对于 instance.update()，实际上就是上面执行的 componentUpdate 函数。

```typescript
const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
  const instance = (n2.component = n1.component)!
  if (shouldUpdateComponent(n1, n2, optimized)) {
    if (__FEATURE_SUSPENSE__ && instance.asyncDep && !instance.asyncResolved) {
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

## ShapeFlages 如何而来？

刚刚说了 ShapeFlages,那你肯定会好奇 ShapeFlages 是怎么被 vue 分析出来的,其实直接看看 createVnode 就好了

### 现象

```Vue
<template>
  <Comp></Comp>
</template>
```

这样的一个 template 模板
最终会被编译成

```javascript
const __sfc__ = {}
import {
  resolveComponent as _resolveComponent,
  openBlock as _openBlock,
  createBlock as _createBlock
} from 'vue'
function render(_ctx, _cache) {
  const _component_Comp = _resolveComponent('Comp')

  return _openBlock(), _createBlock(_component_Comp)
}
__sfc__.render = render
__sfc__.__file = 'App.vue'
export default __sfc__
```

### 创建 vnode

createBlack 就是创建 Vnode 的那个函数，其生成 shapeFlag 的核心逻辑如下，
完全就是根据 type 来决定 ShapeFlag 嘛！

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
