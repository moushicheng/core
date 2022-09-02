## 基本概述

reactive 接受一个对象,返回后的便是响应式对象了。

```javascript
const original = { foo: 1 }
const observed = reactive(original)
```

## reactive 的几个基本特性与实现

对于 vue 响应式，我们往往比较有几个常见问题，比如：

1. get 的依赖收集如何？
2. set 如何触发依赖？
3. 深度响应如何做？
4. 除了 get，set 还对哪些原子操作进行了代理？
   下面我们就来一一解答

### Get

get 有很多边缘判断，这里我们就直接看核心操作,即获取，追踪，返回。

```javascript
function get(target: Target, key: string | symbol, receiver: object) {
  //获取value
  const res = Reflect.get(target, key, receiver)
  //追踪value
  if (!isReadonly) {
    track(target, TrackOpTypes.GET, key)
  }
  //返回value
  return res
}
```

接下来让我们再看看 track 追踪了什么

```javascript
function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    const eventInfo = __DEV__
      ? { effect: activeEffect, target, type, key }
      : undefined

    trackEffects(dep, eventInfo)
  }
}
```

上面的 dep 获取关系大概如下：

![image-20220830174654296](C:\Users\moush\AppData\Roaming\Typora\typora-user-images\image-20220830174654296.png)

最后再看看 trackEffects

```javascript
function trackEffects(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  let shouldTrack = false
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit // set newly tracked
      shouldTrack = !wasTracked(dep)
    }
  } else {
    // Full cleanup mode.
    shouldTrack = !dep.has(activeEffect!)
  }

  if (shouldTrack) {
    dep.add(activeEffect!) //核心操作
    activeEffect!.deps.push(dep)
    if (__DEV__ && activeEffect!.onTrack) {
      activeEffect!.onTrack({
        effect: activeEffect!,
        ...debuggerEventExtraInfo!
      })
    }
  }
}
```

很简单，其实核心就是获取依赖 dep.add(activeEffect!)

### Get 深度响应

```javascript
function get(target: Target, key: string | symbol, receiver: object) {
  //...
  if (shallow) {
    return res
  }
  //深响应
  if (isObject(res)) {
    // Convert returned value into a proxy as well. we do the isObject check
    // here to avoid invalid value warning. Also need to lazy access readonly
    // and reactive here to avoid circular dependency.
    return isReadonly ? readonly(res) : reactive(res)
  }
  //...
}
```

同样也很简单，就是当你获取深层对象时，将其也响应化返回即可。



最后我们总结一下Get做了什么，其实就是如下图，

1.获取依赖数组 ：按taget获取depsMap，再按key获取对应的dep依赖数组

 ![image-20220830174654296](C:\Users\moush\AppData\Roaming\Typora\typora-user-images\image-20220830174654296.png)

2.添加effect： dep.add(activeEffect)

### Set

对于 set，依然是一大堆边界判断+核心逻辑，我们只看核心逻辑

```javascript
function set(
  target: object,
  key: string | symbol,
  value: unknown,
  receiver: object
): boolean {
  //通过hadKey来判断当前set逻辑是是新增还是修改
  const hadKey =
    isArray(target) && isIntegerKey(key)
      ? Number(key) < target.length
      : hasOwn(target, key)
  //获取
  const result = Reflect.set(target, key, value, receiver)
  // don't trigger if target is something up in the prototype chain of original
  if (target === toRaw(receiver)) {
    if (!hadKey) {
      //触发依赖更新
      trigger(target, TriggerOpTypes.ADD, key, value)
    } else if (hasChanged(value, oldValue)) {
      //触发依赖更新
      trigger(target, TriggerOpTypes.SET, key, value, oldValue)
    }
  }
  return result
}
```

核心逻辑主要还是 trigger,现在让我们看看 trigger

```javascript
 function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }

  let deps: (Dep | undefined)[] = []
  //....省去填充deps的逻辑,会根据不同情况填充deps数组
  //比如如果key==length，就只会填入和length有关的deps，例如下↓
  // else if (key === 'length' && isArray(target)) {
  //   depsMap.forEach((dep, key) => {
  //     if (key === 'length' || key >= (newValue as number)) {
  //       deps.push(dep)
  //     }
  //   })
  // }

  const eventInfo = __DEV__
    ? { target, type, key, newValue, oldValue, oldTarget }
    : undefined

  if (deps.length === 1) {
    triggerEffects(deps[0], eventInfo)
  }
  else{
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    triggerEffects(createDep(effects), eventInfo) //执行所有effect
  }
}
```
让我们再看看effect的执行包装逻辑
```javascript
function triggerEffects(
  dep: Dep | ReactiveEffect[],
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  // spread into array for stabilization
  //这里是为了给是否拥有computed的effect区分执行先后
  const effects = isArray(dep) ? dep : [...dep]
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect, debuggerEventExtraInfo)
    }
  }
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect, debuggerEventExtraInfo)
    }
  }
}

//更新会先执行onTrigger，再执行scheduler或者run，scheduler的优先级>run 
function triggerEffect(
  effect: ReactiveEffect,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  if (effect !== activeEffect || effect.allowRecurse) {
    if (__DEV__ && effect.onTrigger) {
      effect.onTrigger(extend({ effect }, debuggerEventExtraInfo))
    }
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}
```
据此，我们总结一下:
1. set的核心逻辑是trigger，触发依赖更新
2. 触发时，找到合适的deps，然后再依次执行所有deps上的更新
3. 更新会先执行onTrigger，再执行scheduler或者run，scheduler的优先级>run 

看完之后，我们会有几个子问题
1. computed是什么,为什么要按computed区分前后执行顺序?
2. onTrigger是什么？
   接下来我们再一一解答。

### computed相关

![image-20220831165524994](C:\Users\moush\AppData\Roaming\Typora\typora-user-images\image-20220831165524994.png)

我们先来看看[官方文档](https://cn.vuejs.org/api/reactivity-core.html#computed)，注意到最下面的调试，有一个onTrigger，那我们的第二个子问题也就迎刃而解了，它是响应式变量的生命周期函数，在变量更新前执行。

接下来，在让我们理解一下computed函数的含义，在vue2中我们知道它是计算属性，那既然是计算属性，就要保持其数据”最新“，所以在更新effect的时候也要将其提前，这么说可能有点抽象，接下来让我们看一个demo

```javascript
<template>
  <div>
    <button @click="addCount">add++</button>
  </div>
</template>

<script setup>
import { ref, computed, effect } from 'vue'
const count = ref(1)
effect(() => {
  if(plusOne){
    console.log(plusOne.value)
  }
})
var plusOne = computed(() => count.value + 1)


function addCount() {
  count.value++;
}
</script>

```

我们特地让effect的注册提前，点击按钮，会发现plusOne总是新增之后的值，这是因为computed总是先触发，而其相关的effect后触发，就算effect提前注册，也没用。

