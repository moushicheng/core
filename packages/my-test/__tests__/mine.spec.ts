import { data1, data2 } from './index'
import { defineComponent as _defineComponent } from 'vue'
import {
  createElementVNode as _createElementVNode,
  openBlock as _openBlock,
  createBlock as _createBlock,
  createCommentVNode as _createCommentVNode,
  createElementBlock as _createElementBlock,
  renderList as _renderList,
  Fragment as _Fragment,
  toDisplayString as _toDisplayString,
  createStaticVNode as _createStaticVNode
} from 'vue'
import {
  nextTick,
  createApp,
  nodeOps,
  ref,
  serializeInner,
  h
} from '@vue/runtime-test'
import { baseCompile } from '@vue/compiler-core'


describe('my test', () => {
  test('测试快照 data1', () => {
    expect(data1()).toMatchSnapshot({
      name: 'Jsoning',
      age: 26,
      time: '2020.1.1'
    })
  })

  test('测试快照 data3', () => {
    expect(data2()).toMatchSnapshot({
      name: 'Jsoning',
      age: 26,
      time: expect.any(Date) //用于声明是个时间类型，否则时间会一直改变，快照不通过
    })
  })
  test('测试unmounted1', async () => {
    const PageLayout = _defineComponent({
      setup() {
        return () => (
          _openBlock(), _createElementBlock('span', null, 'empty page')
        )
      }
    })
    const cur = ref(0)
    function toggle() {
      cur.value = cur.value === 0 ? 1 : 0
    }
    const Comp = _defineComponent({
      __name: 'Comp',
      setup() {
        return () => {
          return (
            _openBlock(),
            _createElementBlock('div', null, [
              _createElementVNode('button', { onClick: toggle }, 'Toggle'),
              cur.value == 0
                ? (_openBlock(), _createBlock(PageLayout, { key: 0 }))
                : _createCommentVNode('v-if', true)
            ])
          )
        }
      }
    })
    const root = nodeOps.createElement('div')
    createApp(Comp).mount(root)
    expect(serializeInner(root)).toBe(
      `<div><button>Toggle</button><span>empty page</span></div>`
    )

    toggle()
    await nextTick()

    expect(serializeInner(root)).toBe(
      `<div><button>Toggle</button><!--v-if--></div>`
    )
  })

  test('测试unmounted2', async () => {
    const PageLayout = _defineComponent({
      setup() {
        return () => h('span', null, 'empty page')
      }
    })
    const cur = ref(0)
    function toggle() {
      cur.value = cur.value === 0 ? 1 : 0
    }
    const Comp = _defineComponent({
      __name: 'Comp',
      setup() {
        return () => {
          return h(
            'div',
            null,
            cur.value == 0
              ?h(PageLayout)
              : _createCommentVNode('v-if', true)
          )
        }
      }
    })
    const root = nodeOps.createElement('div')
    createApp(Comp).mount(root)
    expect(serializeInner(root)).toBe(
      `<div><span>empty page</span></div>`
    )

    toggle()
    await nextTick()

    expect(serializeInner(root)).toBe(
      `<div><!--v-if--></div>`
    )
  })
})
