import { useCssVars, Transition, render } from '@vue/runtime-dom'
import { ref, h, withCtx, Teleport, nextTick } from '@vue/runtime-test'
describe('my test', () => {
  test('1', async () => {
    const target = document.createElement('div')
    const root = document.createElement('div')

    const color = ref('red')
    const showThing = ref(true)
    const Comp = {
      setup() {
        useCssVars(_ctx => ({
          'color': color.value
        }))
        return () => {
          return h(
            Teleport,
            { to: target },
            h(Transition, null, {
              default: withCtx(() => [
                showThing.value
                  ? h('div', { key: 0, class: 'text' }, 'Transition')
                  : 'null'
              ])
            })
          )
        }
      }
    }
    render(h(Comp), root)
    await nextTick()
  })
})
