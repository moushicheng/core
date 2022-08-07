```javascript
test('should preserve state', async () => {
    const viewRef = ref('one')
    const instanceRef = ref<any>(null)
    const App = {
      //render会被丢到reactiveEffect内部执行，以此使render被其内部的ref数据捕获
      render() {
        return h(KeepAlive, null, {
          default: () => h(views[viewRef.value], { ref: instanceRef })
        })
      }
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>one</div>`)
```

以上的流程是

1.  h(App)获得 App 的 vnode 对象
2.  然后把 h(App)交由 render 函数挂载到 root 上
3.  挂载的过程中,APP.render 的会被丢到 reactiveEffect 内部执行，以此使 render 被相关 ref 捕获
4.  而 APP.render 返回的 KeepAlive 实例会被真正挂载，这里对应2要真正挂载的实例。

```javascript
const subTree = (instance.subTree = renderComponentRoot(instance)) //会调用App.render
//将KeepAlive组件实例挂载到root上
patch(null, subTree, container, anchor, instance, parentSuspense, isSVG)
```
5. KeepAlive与一般组件挂载实例流程无差别遵照一般组件挂载流程理解即可（会有几个if可能被命中执行，其他流程一样）
6. 重要的是KeepAlive执行的setup

## KeepAlive.setup
