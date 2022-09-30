## 寻找核心逻辑

transform调用：

```javaScript
transform(
    ast,
    extend({}, options, {
      prefixIdentifiers,
      nodeTransforms: [
        ...nodeTransforms,
        ...(options.nodeTransforms || []) // user transforms
      ],
      directiveTransforms: extend(
        {},
        directiveTransforms,
        options.directiveTransforms || {} // user transforms
      )
    })
  )
```
transform处理ast，是generate前的最后一道工序,而transform逻辑本体也比较简约
```javascript
 function transform(root: RootNode, options: TransformOptions) {
  const context = createTransformContext(root, options)
  traverseNode(root, context) //主要逻辑
  //...省略一些边缘判断和后处理
  //还有一堆root.xxx=content.xxx，估计是traverseNode把处理结果暂时都放到content上了，最后还得往回赋值一下
}
```
主要逻辑在traverseNode,其先执行所有nodeTransforms，会对不同类型的节点（比如v-if，v-for）进行专门的转换工作，
节点转换函数会返回一个exitFns，后期会按序调用，类似于冒泡机制，并在末尾递交node

```javascript
 function traverseNode(
  node: RootNode | TemplateChildNode,
  context: TransformContext
) {
  context.currentNode = node
  // apply transform plugins
  const { nodeTransforms } = context
  const exitFns = [] //逃离函数，最后再回头执行，类似于冒泡机制
  //nodeTransforms貌似是一种插件机制，貌似跟switch case差不多，只是一种解耦
  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](node, context)
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }
    if (!context.currentNode) {
      // node was removed
      return
    } else {
      // node may have been replaced
      node = context.currentNode //递交node
    }
  }
  //...
```
当所有transform执行完毕后,会根据情况执行helper，或者再次递归执行traverseNode
1. 对于vif，会对其分支branch递归执行traverseNode
2. 对于IF_BRANCH，v-for，element（元素），root（根节点）会遍历children，逐个traverseNode
这一切做完之后，再冒泡执行逃离函数
```javascript
 switch (node.type) {
    case NodeTypes.COMMENT:
      if (!context.ssr) {
        // inject import for the Comment symbol, which is needed for creating
        // comment nodes with `createVNode`
        context.helper(CREATE_COMMENT)
      }
      break
    case NodeTypes.INTERPOLATION:
      // no need to traverse, but we need to inject toString helper
      if (!context.ssr) {
        context.helper(TO_DISPLAY_STRING)
      }
      break

    // for container types, further traverse downwards
    case NodeTypes.IF:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context)
      }
      break
    case NodeTypes.IF_BRANCH:
    case NodeTypes.FOR:
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context) //遍历children，逐个traverseNode
      break
  }

  // exit transforms
  context.currentNode = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}
```

大致的运行链路我们盘完了，但真正处理ast节点的逻辑我是一点都没讲啊233，
## 举个例子
v-if&&v-for的全链路逻辑从此入：↓
```javascript
const { node: forNode } = parseWithForTransform(
        '<span v-for="index in 5" v-if="false" />'
)
function parseWithForTransform(
  template: string,
  options: CompilerOptions = {}
) {
  const ast = parse(template, options)
  //从这里开始
  transform(ast, {
    nodeTransforms: [
      transformIf,
      transformFor,
      ...(options.prefixIdentifiers ? [transformExpression] : []),
      transformSlotOutlet,
      transformElement
    ],
    directiveTransforms: {
      bind: transformBind
    },
    ...options
  })
  return {
    root: ast,
    node: ast.children[0] as ForNode & { codegenNode: ForCodegenNode }
  }
}
```
我们先走一遍流程，然后最后再一次性总结全链路的流程究竟如何。
从transform的第二个属性我们会看到，对于node我们会先处理transformIf，然后再依次for，slot，element
现在先看看v-if的处理逻辑究竟如何
## v-if
我们浅看一下transformIf的逻辑,但首先我们得弄明白createStructuralDirectiveTransform (函数名翻译过来就是:创建带有某种结构的指令的transform)干了什么
```javascript
function createStructuralDirectiveTransform(
  name: string | RegExp,
  fn: StructuralDirectiveTransform
): NodeTransform {
  const matches = isString(name)
    ? (n: string) => n === name
    : (n: string) => name.test(n)

  return (node, context) => {
    if (node.type === NodeTypes.ELEMENT) {
      const { props } = node
      // structural directive transforms are not concerned with slots
      // as they are handled separately in vSlot.ts
      if (node.tagType === ElementTypes.TEMPLATE && props.some(isVSlot)) {
        return
      }
      const exitFns = []
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === NodeTypes.DIRECTIVE && matches(prop.name)) {
          // structural directives are removed to avoid infinite recursion
          // also we remove them *before* applying so that it can further
          // traverse itself in case it moves the node around
          props.splice(i, 1) //削去正在处理的props
          i--
          const onExit = fn(node, prop, context)
          if (onExit) exitFns.push(onExit)
        }
      }
      return exitFns
    }
  }
}
```
createStructuralDirectiveTransform 只是更好地封装了fn回调，传递了node(当前节点ast)，prop（当前属性ast）,fn的作用是处理节点，生成codegen
看看v-if的fn回调
```javascript
function processIf(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (
    node: IfNode,
    branch: IfBranchNode,
    isRoot: boolean
  ) => (() => void) | undefined
){
    const branch = createIfBranch(node, dir) //形成branch结构,会将props.if和node的子父关系变成，branch和node的父子关系。
    const ifNode: IfNode = { //利用branch生成ifNode
      type: NodeTypes.IF,
      loc: node.loc,
      branches: [branch]
    }
    //用ifNode替换parent ast中的node（在同样的位置），并递交node
    //然后会在逃离函数执行时，将彻底处理好的ast赋予codegenNode
    context.replaceNode(ifNode) //  context.parent.children[context.childIndex] = context.currentNode = node`
     if (processCodegen) { //v-if最终会进入这里
      return () => {
        if (isRoot) {
        //生成codegenNode，用于下一gen阶段
          ifNode.codegenNode = createCodegenNodeForBranch(
            branch,
            key,
            context
          ) as IfConditionalExpression
        } else {
          // attach this branch's codegen node to the v-if root.
          const parentCondition = getParentCondition(ifNode.codegenNode!)
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            key + ifNode.branches.length - 1,
            context
          )
        }
      }
     }
}
```
逃离函数返回之后，我们会继续处理for,slot,element的transform,
根据上面我给的注释，我相信读者大概明白了v-if做了什么：
1. v-if截取原node（element）中的props，并处理成branch 
注意：branch和原node是父子关系，与原来node，v-if prop关系颠倒
2. 然后利用branch生成ifNode，并递交给下一个transform进行处理 （节点递交）
3. 逃离函数会利用最终一轮次transform的处理，生成最终的codegenNode。

## v-for
我们梳理一下现在的node层级
```
-原root
 -IfNode
  -span ast //对于现在的span ast，其上还有未处理的for props,接下来就是准备处理for props
```
处理for的主逻辑
```javascript
 function processFor(
  node: ElementNode,
  dir: DirectiveNode,
  context: TransformContext,
  processCodegen?: (forNode: ForNode) => (() => void) | undefined
) {
  if (!dir.exp) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_FOR_NO_EXPRESSION, dir.loc)
    )
    return
  }
//对表达式进行解析，提取解析xxx in xxx 左右两边的部分
  const parseResult = parseForExpression(
    // can only be simple expression because vFor transform is applied
    // before expression transform.
    dir.exp as SimpleExpressionNode,
    context
  ) 

  if (!parseResult) {
    context.onError(
      createCompilerError(ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION, dir.loc)
    )
    return
  }

  const { addIdentifiers, removeIdentifiers, scopes } = context
  const { source, value, key, index } = parseResult
  //生成forNode
  const forNode: ForNode = {
    type: NodeTypes.FOR,
    loc: dir.loc,
    source,
    valueAlias: value,
    keyAlias: key,
    objectIndexAlias: index,
    parseResult,
    children: isTemplateNode(node) ? node.children : [node]
  }

  context.replaceNode(forNode)

  // bookkeeping
  scopes.vFor++
  if (!__BROWSER__ && context.prefixIdentifiers) {
    // scope management
    // inject identifiers to context
    value && addIdentifiers(value)
    key && addIdentifiers(key)
    index && addIdentifiers(index)
  }

  const onExit = processCodegen && processCodegen(forNode)

  return () => {
    scopes.vFor--
    if (!__BROWSER__ && context.prefixIdentifiers) {
      value && removeIdentifiers(value)
      key && removeIdentifiers(key)
      index && removeIdentifiers(index)
    }
    if (onExit) onExit()
  }
}
```
首先看这,其对v-for的表达式进行了解析，解析(value,key) in source,将source, value, key, index 解析出来供forNode生成使用
```javascript
 const parseResult = parseForExpression(
    // can only be simple expression because vFor transform is applied
    // before expression transform.
    dir.exp as SimpleExpressionNode,
    context
  ) 
```
然后生成forNode,注意children，我们会发现这里与原node 父子关系逆转
```javascript
  const forNode: ForNode = {
    type: NodeTypes.FOR,
    loc: dir.loc,
    source,
    valueAlias: value,
    keyAlias: key,
    objectIndexAlias: index,
    parseResult,
    children: isTemplateNode(node) ? node.children : [node]
  }
```
也就是说现在的层级关系是
```

-原root
 -IfNode
  -ForNode
   -span ast
```
然后便执行回调
```javascript
 return processFor(node, dir, context, forNode => {
      // create the loop render function expression now, and add the
      // iterator on exit after all children have been traversed
      // 现在创建循环渲染函数表达式，并在遍历所有子函数后在退出时添加迭代器
      const renderExp = createCallExpression(helper(RENDER_LIST), [
        forNode.source
      ]) as ForRenderListExpression

      //...
      //生成真codegen
      forNode.codegenNode = createVNodeCall(
        context,
        helper(FRAGMENT),
        undefined,
        renderExp,
        fragmentFlag +
          (__DEV__ ? ` /* ${PatchFlagNames[fragmentFlag]} */` : ``), //注意这里，说明vue3是把for块看做一个fragmentFlag进行处理的
        undefined,
        undefined,
        true /* isBlock */,
        !isStableFragment /* disableTracking */,
        false /* isComponent */,
        node.loc
      ) as ForCodegenNode

      return () => {
        // finish the codegen now that all children have been traversed
        // 逃离函数 完成一些收尾工作
    })
```
最后生成的codegenNode如下：↓
![image-20220904110350092](C:\Users\moush\AppData\Roaming\Typora\typora-user-images\image-20220904110350092.png)

## https://github.com/vuejs/core/issues/6617
方案1： transfrom.context处理静态提升的children，删去disabled:false这种元素
方案2： 渲染器修改静态节点渲染
方案3： 使具有boolean的attr去除hoist（不能再被静态提升）
### 缺陷
方案1：可能会有性能问题。因为正则查找可能所有boolean attr可能会比较耗时
方案2：运行时修改方案，不符合设计逻辑（静态提升发生在编译期
方案3：把本能提升的hoist，直接去除，过于粗暴，也不太好

综合方案1和方案3
决定在transform的 traverseNode阶段，将 带有boolean attr，且hoist==false的节点的boolean attr剔除，这样既不影响提升，又不会照成太大的性能问题。
