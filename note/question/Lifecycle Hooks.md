![组件生命周期图示](https://cn.vuejs.org/assets/lifecycle.16e4c08e.png)

## setup 为什么在beforeCreated之前执行？

1. 源码使然
2. setup虽然是组件初始化的一部分，但setup里可以注入beforeCreated hook，如果在beforeCreated之后执行setup，就没法注入beforeCreated钩子了。