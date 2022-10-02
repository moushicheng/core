1. 编译有三步重要操作 parse,transform 和generate

parse做的是将模板转换成html ast

transform 将html ast 转换成 JavaScript ast （其实就是生成gencodeNode）

generate做的是生成最终代码
