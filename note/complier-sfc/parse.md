## 一句话概述
parse接受模板字符串输入，处理其中的标签，生成AST，返回描述AST的descriptor
## 粗略过程
标签有四种类型：
1. template
2. script
3. style
4. custom （普通节点

parse所做的事:
1. 解析标签，转换成ast
    ast结构
    ```
    -root
    - template node
    - script node
    - style node
    - custom node
    ```
2. 对ast子节点的处理
   - template模板标签类型ast  descriptor.template = node
   - script脚本标签类型ast    descriptor.scriptSetup = scriptBlock
   - style样式标签类型ast     descriptor.styles.push(styleBlock)
   - custom通用类型标签ast    descriptor.customBlocks.push(createBlock(node, source, pad))
3. 为节点生成sourcemap
4. 解析cssVars
5. 处理slotted
6. 根据前面处理的结果，返回描述ast的descriptor


## 细节
### template解析
```typescript
const ast = compiler.parse(source, {
    // there are no components at SFC parsing level
    isNativeTag: () => true,
    // preserve all whitespaces
    isPreTag: () => true,
    getTextMode: ({ tag, props }, parent) => {
      // all top level elements except <template> are parsed as raw text
      // containers
      if (
        (!parent && tag !== 'template') ||
        // <template lang="xxx"> should also be treated as raw text
        (tag === 'template' &&
          props.some(
            p =>
              p.type === NodeTypes.ATTRIBUTE &&
              p.name === 'lang' &&
              p.value &&
              p.value.content &&
              p.value.content !== 'html'
          ))
      ) {
        return TextModes.RAWTEXT
      } else {
        return TextModes.DATA
      }
    },
    onError: e => {
      errors.push(e)
    }
  })
```
这里的Complier是什么?它来自于complier-core中的baseParse，具体细节暂鸽
```typescript
export function baseParse(
  content: string,
  options: ParserOptions = {}
): RootNode {
  const context = createParserContext(content, options)
  const start = getCursor(context)
  return createRoot(
    parseChildren(context, TextModes.DATA, []),
    getSelection(context, start)
  )
}
```

## 子节点处理
对于template主要就是做了
descriptor.template与createBlock的双向指定
```typescript
ast.children.forEach(node => {
    switch (node.tag) {
      case 'template':
        if (!descriptor.template) {
          const templateBlock = (descriptor.template = createBlock(
            node,
            source,
            false
          ) as SFCTemplateBlock)
          templateBlock.ast = node

          // warn against 2.x <template functional>
          if (templateBlock.attrs.functional) {
            const err = new SyntaxError(
              `<template functional> is no longer supported in Vue 3, since ` +
                `functional components no longer have significant performance ` +
                `difference from stateful ones. Just use a normal <template> ` +
                `instead.`
            ) as CompilerError
            err.loc = node.props.find(p => p.name === 'functional')!.loc
            errors.push(err)
          }
        } else {
          errors.push(createDuplicateBlockError(node))
        }
        break
      case 'script':
        //...
        break
      case 'style':
        //...
        break
      default:
        descriptor.customBlocks.push(createBlock(node, source, pad))
        break
    }
  })
```
createBlock是什么？
它返回的结构如下
```typescript
export interface SFCBlock {
  type: string
  content: string
  attrs: Record<string, string | true>
  loc: SourceLocation
  map?: RawSourceMap
  lang?: string
  src?: string
}
```
基本上是规范化了ast节点内容。
后面的ast，styles做的处理都差不多，不赘述。
## 生成sourcemap
再然后，生成sourcemap
```typescript
  if (sourceMap) {
    const genMap = (block: SFCBlock | null) => {
      if (block && !block.src) {
        block.map = generateSourceMap(
          filename,
          source,
          block.content,
          sourceRoot,
          !pad || block.type === 'template' ? block.loc.start.line - 1 : 0
        )
      }
    }
    genMap(descriptor.template)
    genMap(descriptor.script)
    descriptor.styles.forEach(genMap)
    descriptor.customBlocks.forEach(genMap)
  }
```

## 处理cssVars和slotted
```typescript
 descriptor.cssVars = parseCssVars(descriptor)

  // check if the SFC uses :slotted
  //插槽选择器#
  // 默认情况下，作用域样式不会影响到 <slot/> 渲染出来的内容，
  // 因为它们被认为是父组件所持有并传递进来的。使用 :slotted 伪类以明确地将插槽内容作为选择器的目标：
  // <style scoped>
  // :slotted(div) {
  //   color: red;
  // }
  // </style>
  //这里，特意提取了slotted的内容出来。
  const slottedRE = /(?:::v-|:)slotted\(/
  descriptor.slotted = descriptor.styles.some(
    s => s.scoped && slottedRE.test(s.content)
  )

  const result = {
    descriptor,
    errors
  }
  sourceToSFC.set(sourceKey, result)
  return result
```