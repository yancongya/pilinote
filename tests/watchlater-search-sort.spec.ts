import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:8000'

test.describe('稍后再看搜索和排序功能测试', () => {
  test.beforeEach(async ({ request }) => {
    // 设置测试cookie
    await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        username: 'test',
        password: 'test'
      }
    })
  })

  test('搜索功能 - 关键词搜索', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=10&keyword=技术`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    expect(data.data).toHaveProperty('total')
    
    console.log('搜索结果:', JSON.stringify(data, null, 2))
  })

  test('搜索功能 - 空关键词（返回全部）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=5&keyword=`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    
    console.log('空关键词结果:', JSON.stringify(data, null, 2))
  })

  test('排序功能 - 按播放量排序（降序）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=5&order=view&sort_direction=desc`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    
    // 验证是否按播放量降序排列
    const list = data.data.list
    if (list.length > 1) {
      for (let i = 0; i < list.length - 1; i++) {
        const currentView = list[i].view || 0
        const nextView = list[i + 1].view || 0
        expect(currentView).toBeGreaterThanOrEqual(nextView)
      }
    }
    
    console.log('按播放量降序排序结果:', JSON.stringify(data, null, 2))
  })

  test('排序功能 - 按播放量排序（升序）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=5&order=view&sort_direction=asc`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    
    // 验证是否按播放量升序排列
    const list = data.data.list
    if (list.length > 1) {
      for (let i = 0; i < list.length - 1; i++) {
        const currentView = list[i].view || 0
        const nextView = list[i + 1].view || 0
        expect(currentView).toBeLessThanOrEqual(nextView)
      }
    }
    
    console.log('按播放量升序排序结果:', JSON.stringify(data, null, 2))
  })

  test('排序功能 - 按发布时间排序（降序）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=5&order=pubtime&sort_direction=desc`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    
    // 验证是否按发布时间降序排列
    const list = data.data.list
    if (list.length > 1) {
      for (let i = 0; i < list.length - 1; i++) {
        const currentPubtime = list[i].pubtime || 0
        const nextPubtime = list[i + 1].pubtime || 0
        expect(currentPubtime).toBeGreaterThanOrEqual(nextPubtime)
      }
    }
    
    console.log('按发布时间降序排序结果:', JSON.stringify(data, null, 2))
  })

  test('排序功能 - 按添加时间排序（降序）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=5&order=add_time&sort_direction=desc`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    
    // 验证是否按添加时间降序排列
    const list = data.data.list
    if (list.length > 1) {
      for (let i = 0; i < list.length - 1; i++) {
        const currentAddTime = list[i].add_time || 0
        const nextAddTime = list[i + 1].add_time || 0
        expect(currentAddTime).toBeGreaterThanOrEqual(nextAddTime)
      }
    }
    
    console.log('按添加时间降序排序结果:', JSON.stringify(data, null, 2))
  })

  test('排序功能 - 按添加时间排序（升序）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=5&order=add_time&sort_direction=asc`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    
    // 验证是否按添加时间升序排列
    const list = data.data.list
    if (list.length > 1) {
      for (let i = 0; i < list.length - 1; i++) {
        const currentAddTime = list[i].add_time || 0
        const nextAddTime = list[i + 1].add_time || 0
        expect(currentAddTime).toBeLessThanOrEqual(nextAddTime)
      }
    }
    
    console.log('按添加时间升序排序结果:', JSON.stringify(data, null, 2))
  })

  test('组合功能 - 搜索+排序', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=5&keyword=技术&order=view`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    
    console.log('搜索+排序组合结果:', JSON.stringify(data, null, 2))
  })

  test('默认排序（不传order参数）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/watch-later/list?pn=1&ps=5`
    )
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveProperty('list')
    
    console.log('默认排序结果:', JSON.stringify(data, null, 2))
  })
})