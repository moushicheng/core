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

## 提问 
### 父组件更新，子组件会更新吗（子组件并不需要更新的情况下）？
- 结论1：会patch新旧子组件的vnode
- 结论2：新旧子组件patch会被shouldUpdateComponent截断，避免重复渲染
对于shouldUpdateComponent
- 结论1，如果子组件有 directive or transition则返回true
- 结论2, 子组件的dynamicChildren存在
  - 判断PatchFlag.DYNAMIC_SLOTS，直接返回true
  - PatchFlags.FULL_PROPS，进一步判断
  - PatchFlags.PROPS，进一步判断
- 结论3， 子组件的dynamicChildren不存在(只有手动编写render会进入此分支),
  - 比较新旧子vnode上的children是否存在$table，存在则返回true
  - 然后，比较props是否需要更新，如果需要则返回true，不需要则返回false

### 组件的挂载流程?
1. 获得组件的vnode节点，将vnode置于render中执行渲染。
2. render时根据shapeFlag & ShapeFlags.ELEMENT,走到组件对应的更新分支，执行processComponent
3. 在processComponent中根据有无旧vnode，执行了mountComponent  
4. 在mountComponent内部，执行setup函数，获取render
5. 安装render函数，一来是使其封装成componentUpdateFn方便后续更新，二来是将componentUpdateFn被ref侦测（放入ReactiveEffect执行，这就涉及响应式原理了）
6. 执行componentUpdateFn，其核心流程就是执行vnode.render获取新vnode，然后和旧vnode进行patch,（至于如何patch，这又是一个大话题，详细见render.md）