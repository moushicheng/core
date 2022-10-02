1. parse是标签解析器，可以是template styles script ，
2. html -> ast
流程:
```javascript 
function baseParse(
  content: string,
  options: ParserOptions = {}
): RootNode {
  const context = createParserContext(content, options) //生成上下文
  const start = getCursor(context) //获取上下文中的源码位置
  return createRoot(
    parseChildren(context, TextModes.DATA, []),
    getSelection(context, start)
  )
}
```
1. 核心在于parseChildren这个函数,对Template字串进行了解析

## parseChildren
1. parseChildren是有限状态机的执行逻辑,整体是一个while循环，根据mode（当前状态）来消费context中的source，最终得到相关ast
其职责如下:
``` javascript
export const enum TextModes {
  //          | Elements | Entities | End sign              | Inside of
  DATA, //    | ✔        | ✔        | End tags of ancestors |
  RCDATA, //  | ✘        | ✔        | End tag of the parent | <textarea>
  RAWTEXT, // | ✘        | ✘        | End tag of the parent | <style>,<script>
  CDATA,
  ATTRIBUTE_VALUE
}
```
其代码结构如下:
```javascript
 while (!isEnd(context, mode, ancestors)) {
   if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
     if('处理{{'){}
     else if (mode === TextModes.DATA && s[0] === '<') {
      //进入标签开始状态，标签有可能是<div, <!-- , </div>  
      if('处理!'){}
      else if('处理/'){}
      else if('处理开始标签'){}
      else if('处理?'){直接报错}
     }
   } 
   //上述处理都失效，则会转为处理文本
  if (!node) {
      node = parseText(context, mode)
  }
 }
```
在parseChildren下，会处理{{,<,!,/,?


具体讲一个例子
```javascript
 const source = `
<div id="foo" :class="bar.baz">
  {{ world.burn() }}
  <div v-if="ok">yes</div>
  <template v-else>no</template>
  <div v-for="(value, index) in list"><span>{{ value + index }}</span></div>
</div>
`
```
对于解析这样的字串，parseChildren会走进这个分支进行解析,在源码中，这个分支被称为tag-open state,
```javascript
//...
else if (mode === TextModes.DATA && s[0] === '<') {
        if (s.length === 1) {
          emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 1)
        } else if (s[1] === '!') {
        } else if (s[1] === '/') {
        } else if (/[a-z]/i.test(s[1])) {
          node = parseElement(context, ancestors)
   }
}
```
我们首先关注 node = parseElement(context, ancestors)，该函数功能较为核心,其先解析了Tag
```javascript
  function parseElement(context,ancestors){
    //...
    const element = parseTag(context, TagType.Start, parent)
    //...
    //对children进行递归解析，最后得到整个结果
    ancestors.push(element)
    const mode = context.options.getTextMode(element, parent)
    const children = parseChildren(context, mode, ancestors)
    ancestors.pop()
  }
```
parseTag内部会按序解析：标签名，标签属性等，最后会返回element数据结构，记录了标签的必要信息（名称，位置，属性，类型，是否自闭合等等）
具体的解析方式是：一段段解析。
1.解析+消费开始标签
```javascript
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)! //取得开始标签
  const tag = match[1]
  advanceBy(context, match[0].length) //消费+更新pos
```
2.解析属性
```javascript
function parseAttributes(){
 while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '/>')
  ) {
    //... 是一些错误处理

    const attr = parseAttribute(context, attributeNames) //解析具体属性值，依然是匹配，advance那一套

    //... 后处理，比如删去留白
  }
}
```