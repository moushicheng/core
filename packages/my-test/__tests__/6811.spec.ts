import {
  h,
  ref,
  // Suspense,
  render,
  nodeOps,
  provide,
  inject,
  watch,
  nextTick
} from '@vue/runtime-test'

describe('my test', () => {
  const res: string[] = []
  const Async = {
    async setup() {
      const view: any = inject('view')
      watch(
        () => view.value,
        () => {
          res.push('async' + view.value)
        },
        {
          immediate: true,
          flush: 'post'
        }
      )
      return {}
    },
    render() {
      return h('div', 'async')
    }
  }
  const sync = {
    setup() {
      const view: any = inject('view')
      watch(
        () => view.value,
        () => {
          res.push('sync' + view.value)
        },
        {
          immediate: true,
          flush: 'post'
        }
      )
    },
    render() {
      return h('div', 'sync')
    }
  }
  test('#6811', async () => {
    const components = [sync, Async]
    const viewRef = ref(0)
    const root = nodeOps.createElement('div')
    const App = {
      setup() {
        provide('view', viewRef)
      },
      render() {
        return h(components[viewRef.value])
      }
    }
    render(h(App), root)

    await nextTick()
    expect(res).toEqual(['sync0'])

    viewRef.value = 1
    await nextTick()
    expect(res).toEqual(['sync0', 'async1'])
  })
})
