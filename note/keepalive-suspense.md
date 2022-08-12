```javascript
test('test keepalive with suspense', async () => {
    //bug:keepalive is not normal when switch to sync component before Async loading
    const Async = defineAsyncComponent({
      render() {
        return h('div', 'async')
      }
    })
    const sync = {
      render() {
        return h('div', 'sync')
      }
    }
    const components = [Async, sync,]
    const viewRef = ref(0)
    const root = nodeOps.createElement('div') 
    const App = {
      render() {
        return h(KeepAlive, null, {
          default: () => {
            return h(Suspense, null, {
              default: h(components[viewRef.value]),
              fallback: h('div', 'Loading-dynamic-components')
            })
          }
        })
      } 
    }
    render(h(App), root)
    expect(serializeInner(root)).toBe(`<div>Loading-dynamic-components</div>`)

    
   //当viewRef.value=1时，会触发Keepalive的渲染函数
    viewRef.value = 1 
    await nextTick()
    expect(serializeInner(root)).toBe(`<div>sync</div>`)

    viewRef.value = 0
    await nextTick()
    //Is this a mistake?i think .toBe('<div>Loading-dynamic-components</div>') is correct;
    expect(serializeInner(root)).toBe('<!---->')
    Promise.all(deps)
    await nextTick();
    // when async loaded,it still be '<!---->'
    expect(serializeInner(root)).toBe('<!---->') 
    // viewRef.value = 1
    // await nextTick() //TypeError: Cannot read properties of null (reading 'parentNode')
    // expect(serializeInner(root)).toBe(`<div>sync</div>`)
  })
```

## 从这里开始,viewRef改变会依次触发KeepAlive.render（置于componentUpdateFn执行，具体）,Suspense.render（置于componentUpdateFn执行
```javaScript
viewRef.value = 1 
await nextTick()
expect(serializeInner(root)).toBe(`<div>sync</div>`)
```

## KeepAlive.render
1. render的操作对象是Suspense.ssContent和一般组件不同
2. 其他无异，依然是一些缓存存储操作，但最后返回的vnode节点时Suspense，而不是其下的ssContent

## KeepAlive componentUpdateFn后续
1. render执行完后就开始了获取新旧subtree然后patch
```javaScript
        patch(prevTree,nextTree,hostParentNode(prevTree.el!)!getNextHostNode(prevTree),  instance,  parentSuspense,  isSVG
        )
```
2. patch的过程中最终会走向suspense.process，然后执行patchSuspense

## patchSuspense
1. 对新旧ssContent进行更新操作
2. 对比类型，如果类型一样就patch
3. 不一样就先卸载(unmounted)旧ssContent
4. 注意一点unmounted会走KeepAlive deactivated流程，会把旧ssContent移动到存储容器中
```javascript
move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)
```

5. patch前有一步操作看不懂，先记录下来
```javascript
      // increment pending ID. this is used to invalidate async callbacks
      // reset suspense state
      suspense.deps = 0
      // discard effects from pending branch
      suspense.effects.length = 0
      // discard previous container
      suspense.hiddenContainer = createElement('div')
```
6. 然后patch，将新ssContent更新，和正常组件挂载流程无异，但是挂载到的容器是suspense.hiddenContainer容器上
7. 因为deps<=0，会执行suspense.resolve()
### suspense.resolve
1. 对于suspense，如果当前激活实例(这里是Fallback)存在,会先让其卸载
2. 然后，将pendingBranch从off-dom容器移动到实际容器中
3. 移动完了之后，将pendingBranch设为ActiveBranch，然后将pending置空
4. 最后执行所有suspense上的effects 

总结：suspense.resolve会将suspense的状态切换到resolve，这时候所有异步任务都清空且失效了


## bug点
```javascript
    viewRef.value = 0
    await nextTick()
    //Is this a mistake?i think .toBe('<div>Loading-dynamic-components</div>') is correct;
    expect(serializeInner(root)).toBe('<!---->')
```
此时root竟然为一个空的注释节点，按理来说应该是fallback内容，<div>Loading-dynamic-components</div>才对