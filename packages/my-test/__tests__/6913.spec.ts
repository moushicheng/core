import {
  h,
  ref,
  computed,
  openBlock,
  createElementBlock,
  createElementVNode,
  Fragment,
  unref,
  createVNode,
  createTextVNode,
  toDisplayString,
  // Suspense,
  render,
  nodeOps,
  serializeInner
} from '@vue/runtime-test'

describe('my test', () => {
  jest.setTimeout(3000000)
  test('#6811', async () => {
    const num = ref(1)
    const TNode = (props: any) => props.content
    const HelloWorld = computed(() => { 
      return h(() => 'Hello world')
    }) //computed是有缓存更新的，第一次会运行fn，第二次会直接取缓存，所以第一次会被block记录，第二次不会。会导致dynamicChildren缺失节点

    unref(HelloWorld);
    const root = nodeOps.createElement('div')

    setTimeout(() => {
      num.value++
    }, 0)

    const comp = {
      setup() {
        return () => {
          return (
            openBlock(),
            createElementBlock(
              Fragment,
              null,
              [
                createElementVNode('div', null, [
                  createVNode(
                    TNode,
                    { content: unref(HelloWorld) },
                    null,
                    8 /* PROPS */,
                    ['content']
                  )
                ]),
                createTextVNode(' ' + toDisplayString(num.value), 1 /* TEXT */)
              ],
              64 /* STABLE_FRAGMENT */
            )
          )
        }
      }
    }
    render(h(comp), root)
    expect(serializeInner(root)).toBe(`<div>Hello world</div> 1`)

    await new Promise(r => setTimeout(r, 10))
    expect(serializeInner(root)).toBe(`<div>Hello world</div> 2`)
  })
})
