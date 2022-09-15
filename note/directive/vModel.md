1. input更新时触发change事件，会导致绑定上去的ref也会更新
2. ref更新会导致input的值也会更新

v-model就是一个vue内置的自定义指令
created做了一件很重要的事情，即绑定dom事件，在事件触发的时候触发数据更新
细节部分：
1. 利用compositionstart和end区分中英文输入，中文输入只有敲下中文字符时(输入中文的拼音阶段)才会触发input事件，英文输入直接触发
```typeScript
 created(el, { modifiers: { lazy, trim, number } }, vnode) {

    el._assign = getModelAssigner(vnode) //数据更新函数，就是这个assign是this.value=value，这里完成了domValue->refValue的操作
    const castToNumber =
      number || (vnode.props && vnode.props.type === 'number')
    //input事件在输入框输入的时候回实时响应并触发,change在失去焦点才触发
    addEventListener(el, lazy ? 'change' : 'input', e => {
      if ((e.target as any).composing) return //输入中文时，就不要再一直触发input事件了
      let domValue: string | number = el.value
      if (trim) {
        domValue = domValue.trim()
      }
      if (castToNumber) {
        domValue = toNumber(domValue)
      }
      el._assign(domValue)
    })
    if (trim) {
      addEventListener(el, 'change', () => {
        el.value = el.value.trim()
      })
    }
    if (!lazy) {
      addEventListener(el, 'compositionstart', onCompositionStart)
      addEventListener(el, 'compositionend', onCompositionEnd)
      // Safari < 10.2 & UIWebView doesn't fire compositionend when
      // switching focus before confirming composition choice
      // this also fixes the issue where some browsers e.g. iOS Chrome
      // fires "change" instead of "input" on autocomplete.
      //失去焦点时，再触发一下change事件,这是为了配合中文输入
      addEventListener(el, 'change', onCompositionEnd)
    }
```