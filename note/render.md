# 渲染策略
1. template静态分析后会有动态分析功能，其带来几个好处，
- 一是利用block拍平深层vnode更新，一步到位
- 静态推断更新类型标记PathFlag，尽量在dom patch的过程中略过不必要的更新判断
2. 如果直接使用render来渲染组件，则没有上述好处，因为render极其灵活导致不像template模板一样好静态分析。
3. 二者共通的渲染策略：ShapeFlags，在编译期分析vnode类型，在patch的时候直接进入ShapeFlags相关的分支进行单独处理，比如  
  1. shapeFlag & ShapeFlags.ELEMENT，就会执行  processElement
  2. shapeFlag & ShapeFlags.COMPONENT 就会执行 processComponent