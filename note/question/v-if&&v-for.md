v-if与v-for为什么不能一起用？
##表层
如果将v-if和v-for一起使用，会有如下现象：以下是伪代码，方便理解
vue2:
```xml
<for> 
  <if></if>
</for>
```
vue3是
```xml
<if>
  <for></for>
 </if>
```
 优先级不一样,意味着这样一段代码
 ```html
 <span v-for="item in arr" v-if="item==0">1</span>
 ```
 vue3直接报错，vue2会执行“过滤”（只显示值为0的元素)
  ```html
 <span v-for="item in arr" v-if="false">1</span>
  ```
 vue3会直接隐藏整个容器，我们称其为“全局隐藏”
 vue2会执行过滤（全部false就是全体过滤，展现为“隐藏”）但大量重复的for来判断if没有意义  

 所以vue3和vue2在这道题中v-if的语义不一样，前者是隐藏循环，后者循环过滤

源码层面来说vue2的render的策略如下
```javascript
_l(
    items,
    function(item){
        return item==0?1:null
})
```
而对于vue3来说我们可以从transform阶段就看出端倪
transform阶段就是ast->JavaScript ast的阶段,对于v-for，v-if这样的特殊节点，他们的处理逻辑分门别类，按序执行
```javascript
 function getBaseTransformPreset(
  prefixIdentifiers?: boolean
): TransformPreset {
  return [
    [
      transformOnce,
      transformIf,
      transformMemo,
      transformFor,
     //if在for前面，所以处理的ast也是if先行
     //...
    ],
    {
      on: transformOn,
      bind: transformBind,
      model: transformModel
    }
  ]
}
```
经过transform的转换
最后形成的新ast长这样

![image-20220903110448375](C:\Users\moush\AppData\Roaming\Typora\typora-user-images\image-20220903110448375.png)

branches就是if节点的标识！

打开branches发现它有一个子节点就是for

![image-20220903110556614](C:\Users\moush\AppData\Roaming\Typora\typora-user-images\image-20220903110556614.png)

所以印证了我们之前推测的ast结构

```javascript
<if>
  <for></for>
</if>
```

最后在代码生成阶段，也是这样逐层遍历，生成了我们要的render函数，而render外围是处理if，内层是处理for，因此解释了vue3的“全局隐藏”这一特性