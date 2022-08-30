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
  其核心逻辑位于createBaseVnode中
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

