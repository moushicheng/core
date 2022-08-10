```javascript
    const counter = reactive({ num: 0 })
    effect(() => (dummy = counter.num))
```

1. effect的核心在于 reactiveEffect这个对象
2. effect()->const reactiveEffectInstance =new reactiveEffect -> reactiveEffect.run() ->affectEffect=reactiveEffectInstance;
3. 响应式数据在[[getter]]捕获全局变量affectEffect获取reactiveEffectInstance
4. 设置的时候触发reactiveEffectInstance.run更新数据