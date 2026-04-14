import { test, expect } from '@playwright/test';

test.describe('收藏页搜索和排序功能测试', () => {
  const BASE_URL = 'http://localhost:8000';
  
  // 使用有效的收藏夹ID（从实际API获取）
  const FOLDER_ID = 54507208; // 默认收藏夹
  
  // 使用有效的SESSDATA（与watchlater测试相同）
  const SESSDATA = '498df77b%2C1790445512%2Cf6453%2A31CjBgGfJtzXVS6M3YGiToVu5Hp7Mn7lFWsSiYyjXEUXWJNoSQkqfGhkl4TYIyHKB2RhISVllhWk83eDNMVS1oRDlUQi1WX2JPVGtMdURGSWFNenYyTXo2eEZNWl9Zcjl5V3Q3NzZmMHpmLUx5VDd2dlEyX1ZqaDhSMTctVkRqS2xhWGtVczRpRHFRIIEC';
  
  test('收藏页搜索功能 - 关键词搜索', async ({ request }) => {
    // 测试搜索功能
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?keyword=技术&page=1&page_size=5`,
      {
        headers: {
          'Cookie': `SESSDATA=${SESSDATA}`
        }
      }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    expect(data.data).toHaveProperty('page_size');
    
    console.log('搜索结果:', JSON.stringify(data, null, 2));
  });
  
  test('收藏页搜索功能 - 空关键词', async ({ request }) => {
    // 测试空关键词（应该返回所有结果）
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?keyword=&page=1&page_size=5`,
      {
        headers: {
          'Cookie': `SESSDATA=${SESSDATA}`
        }
      }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    
    console.log('空关键词结果:', JSON.stringify(data, null, 2));
  });
  
  test('收藏页排序功能 - 按收藏时间排序', async ({ request }) => {
    // 测试按收藏时间排序（mtime）
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?order=mtime&page=1&page_size=5`,
      {
        headers: {
          'Cookie': `SESSDATA=${SESSDATA}`
        }
      }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('按收藏时间排序结果:', JSON.stringify(data, null, 2));
  });
  
  test('收藏页排序功能 - 按播放量排序', async ({ request }) => {
    // 测试按播放量排序（view）
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?order=view&page=1&page_size=5`,
      {
        headers: {
          'Cookie': `SESSDATA=${SESSDATA}`
        }
      }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('按播放量排序结果:', JSON.stringify(data, null, 2));
  });
  
  test('收藏页排序功能 - 按发布时间排序', async ({ request }) => {
    // 测试按发布时间排序（pubtime）
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?order=pubtime&page=1&page_size=5`,
      {
        headers: {
          'Cookie': `SESSDATA=${SESSDATA}`
        }
      }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('按发布时间排序结果:', JSON.stringify(data, null, 2));
  });
  
  test('收藏页组合功能 - 搜索+排序', async ({ request }) => {
    // 测试搜索和排序组合使用
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?keyword=Blender&order=view&page=1&page_size=5`,
      {
        headers: {
          'Cookie': `SESSDATA=${SESSDATA}`
        }
      }
    );
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('搜索+排序组合结果:', JSON.stringify(data, null, 2));
  });
});

test.describe('稍后再看缓存功能测试', () => {
  test('稍后再看缓存 - 首次请求', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/watch-later/list?pn=1&ps=5');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('list');
    
    console.log('首次请求结果:', JSON.stringify(data, null, 2));
  });
  
  test('稍后再看缓存 - 二次请求（应该命中缓存）', async ({ request }) => {
    // 第一次请求
    const response1 = await request.get('http://localhost:8000/api/watch-later/list?pn=1&ps=5');
    expect(response1.status()).toBe(200);
    
    const data1 = await response1.json();
    expect(data1.success).toBe(true);
    
    // 等待一小段时间（确保缓存已设置）
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 第二次请求（应该命中缓存）
    const response2 = await request.get('http://localhost:8000/api/watch-later/list?pn=1&ps=5');
    expect(response2.status()).toBe(200);
    
    const data2 = await response2.json();
    expect(data2.success).toBe(true);
    
    // 两次请求的数据应该相同
    expect(data2.data).toEqual(data1.data);
    
    console.log('二次请求结果（缓存）:', JSON.stringify(data2, null, 2));
  });
  
  test('缓存失效 - 清除缓存后请求', async ({ request }) => {
    // 第一次请求
    const response1 = await request.get('http://localhost:8000/api/watch-later/list?pn=1&ps=5');
    expect(response1.status()).toBe(200);
    
    // 清除缓存（正确的路径）
    const clearResponse = await request.post('http://localhost:8000/api/cache/invalidate/watch-later');
    expect(clearResponse.status()).toBe(200);
    
    const clearData = await clearResponse.json();
    expect(clearData.message).toContain('缓存已失效');
    
    // 清除缓存后的请求（应该从B站API获取）
    const response2 = await request.get('http://localhost:8000/api/watch-later/list?pn=1&ps=5');
    expect(response2.status()).toBe(200);
    
    const data2 = await response2.json();
    expect(data2.success).toBe(true);
    
    console.log('清除缓存后请求结果:', JSON.stringify(data2, null, 2));
  });
});