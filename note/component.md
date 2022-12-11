## 组件渲染流程 
例子：
```javascript
    const Comp = {
      setup() {
        return () =>
          h('div', '233')
      }
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
```
0. 生成root createElement('div')
1. 生成Comp组件选项的vnode h(Comp) ->vnode
2. 开始渲染 render->patch(vnode)->processComponent->mountComponent  
3. 在mountComponent内部，先setupComponent(instance) 得到setup返回的render函数,在将render置入  setupRenderEffect中执行
setupRenderEffect内部：
1. 将setup.render封装成componentUpdateFn（组件更新函数
2. 组件更新函数componentUpdateFn被放入new ReactiveEffect中执行,此时被“effect”化，渲染函数内部的ref会将ReactiveEffect捕获以便完成数据绑定。
componentUpdateFn内部：
1. 根据vnode.isMounted进行不同处理，如果已经挂载，就更新，没挂载就挂载。
2. 执行renderComponentRoot返回subTree,renderComponentRoot是对render的一层封装，包含一些处理，比如区分组件类型来执行render
3. 利用子树再进行新一轮patch(挂载或者更新)
4. 这里的子树就是div的vnode，后续就是执行div的挂载了，不赘述

## 提问 
### 父组件更新，子组件会更新吗（子组件并不需要更新的情况下）？
```javascript
const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
    const instance = (n2.component = n1.component)!
    if (shouldUpdateComponent(n1, n2, optimized)) {
        instance.next = n2
        invalidateJob(instance.update)
        instance.update() //更新子组件
    } else {
      // no update needed. just copy over properties
      n2.el = n1.el
      instance.vnode = n2
    }
  }
```
- 结论1：会patch新旧子组件的vnode
- 结论2：新旧子组件patch会被shouldUpdateComponent截断，避免重复渲染
对于shouldUpdateComponent,返回true则更新，返回false则截断
- 结论1，如果子组件有 directive or transition则返回true
- 结论2, 子组件的dynamicChildren存在
  - 判断PatchFlag.DYNAMIC_SLOTS，直接返回true
  - PatchFlags.FULL_PROPS，进一步判断，返回 hasPropsChanged(prevProps, nextProps!, emits)（检查props更新，需要则true，不需要则false）
  - PatchFlags.PROPS，进一步判断
- 结论3， 子组件的dynamicChildren不存在(只有手动编写render会进入此分支),
  - 比较新旧子vnode上的children是否存在$table，存在则返回true
  - 然后，返回hasPropsChanged(prevProps, nextProps!, emits)（检查props更新）

### 组件的挂载流程?(问patch)
1. 获得组件的vnode节点，将vnode置于render中执行渲染。
2. render时根据shapeFlag & ShapeFlags.ELEMENT,走到组件对应的更新分支，执行processComponent
3. 在processComponent中根据有无旧vnode，执行了mountComponent  
4. 在mountComponent内部，执行setup函数，获取render
5. 安装render函数，一来是使其封装成componentUpdateFn方便后续更新，二来是将componentUpdateFn被ref侦测（放入ReactiveEffect(相当于放入effect)执行，effect会将componentUpdateFn赋予全局activeEffect，便于get捕获）
6. 执行componentUpdateFn，其核心流程就是执行vnode.render获取新vnode，然后和旧vnode进行patch,（至于如何patch，这又是一个大话题，详细见render.md）