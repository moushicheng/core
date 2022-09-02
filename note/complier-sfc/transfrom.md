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
  traverseNode(root, context) //核心逻辑
  //...省略一些边缘判断和后处理
  //还有一堆root.xxx=content.xxx，估计是traverseNode把处理结果暂时都放到content上了，最后还得往回赋值一下
}
```
