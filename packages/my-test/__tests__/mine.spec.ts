import { data1, data2 } from './index'

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
})
