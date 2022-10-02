标签有四种类型：
1. template
2. script
3. style
4. custom （普通节点


1. 解析标签，转换成ast
2. 对ast childrenNode 分别做处理
- template
- script
- style
3. 为所有节点生成sourcemap
4. 解析cssVars
6. 处理slotted

返回