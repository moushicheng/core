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
 vue3会直接隐藏整个容器  
 vue2会执行过滤（全部false就是全体过滤，变现为“隐藏”）但大量重复的for来判断if没有意义  

 所以vue3和vue2在这道题中v-if的语义不一样，前者是隐藏循环，后者循环过滤

源码层面来说vue2的render是(其实笔者没看过这里的源码，但render的策略如下):
```javascript
_l(
    items,
    function(item){
        return item==0?1:null
})
```
而对于vue3来说我们可以从transform阶段就看出端倪