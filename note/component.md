## 组件渲染流程
例子：
```javascript
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
```
0. 生成root createElement('div')
1. 生成Comp组件选项的vnode h(Comp) ->vnode
2. 开始渲染 render->patch(vnode)->processComponent->mountComponent  
3. 在mountComponent内部，先setupComponent(instance) 得到setup返回的render函数
在setupRenderEffect内部：
1. 再执行setupRenderEffect，其实就是对setup.render的封装成componentUpdateFn（组件更新函数
2. 组件更新函数componentUpdateFn被放入new ReactiveEffect中执行,此时被“effect”化，渲染函数内部的ref会将ReactiveEffect捕获以便完成数据绑定。
在componentUpdateFn内部：
1. 根据vnode.isMounted进行不同处理，如果已经挂载，就更新，没挂载就挂载。
2. 执行renderComponentRoot返回subTree,renderComponentRoot是对render的一层封装，包含一些处理，比如区分组件类型来执行render，render完之后对子树进行正常化处理。
3. 利用子树再进行新一轮patch(挂载或者更新)