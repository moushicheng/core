先看看函数签名
```typescript
/**
 * Compile `<script setup>`
 * It requires the whole SFC descriptor because we need to handle and merge
 * normal `<script>` + `<script setup>` if both are present.
 */
function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions
): SFCScriptBlock
```
该函数的作用是将ast转换成render（可以理解为执行了中间的transform 和gen步骤