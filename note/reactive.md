## 基本概述
reactive接受一个对象,返回后的便是响应式对象了。 
```javascript 
    const original = { foo: 1 }
    const observed = reactive(original)
```
## reactive的几个基本特性与实现