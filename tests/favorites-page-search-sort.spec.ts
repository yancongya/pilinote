import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';
const FOLDER_ID = 54507208; // 使用实际的收藏夹ID

test.describe('收藏页搜索和排序功能测试', () => {
  test.beforeEach(async ({ request }) => {
    // 设置SESSDATA cookie（需要替换为实际的有效cookie）
    await request.post(`${BASE_URL}/api/auth/login`, {
      json: {
        sessdata: 'your_actual_sessdata_here'
      }
    });
  });

  test('搜索功能 - 关键词搜索', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?keyword=技术&page=1&page_size=5`
    );
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('搜索结果:', JSON.stringify(data, null, 2));
  });

  test('搜索功能 - 空关键词（返回全部）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?page=1&page_size=5`
    );
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('空关键词结果:', JSON.stringify(data, null, 2));
  });

  test('排序功能 - 按播放量排序（降序）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?order=view&sort_direction=desc&page=1&page_size=5`
    );
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    // 验证排序：第一个视频的播放量应该 >= 第二个视频的播放量
    const medias = data.data.medias;
    if (medias.length >= 2) {
      expect(medias[0].view).toBeGreaterThanOrEqual(medias[1].view);
    }
    
    console.log('按播放量降序排序结果:', JSON.stringify(data, null, 2));
  });

  test('排序功能 - 按播放量排序（升序）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?order=view&sort_direction=asc&page=1&page_size=5`
    );
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    // 验证排序：第一个视频的播放量应该 <= 第二个视频的播放量
    const medias = data.data.medias;
    if (medias.length >= 2) {
      expect(medias[0].view).toBeLessThanOrEqual(medias[1].view);
    }
    
    console.log('按播放量升序排序结果:', JSON.stringify(data, null, 2));
  });

  test('排序功能 - 按收藏时间排序（降序）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?order=favorite&sort_direction=desc&page=1&page_size=5`
    );
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('按收藏时间降序排序结果:', JSON.stringify(data, null, 2));
  });

  test('组合功能 - 搜索+排序', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?keyword=技术&order=view&sort_direction=desc&page=1&page_size=5`
    );
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('搜索+排序组合结果:', JSON.stringify(data, null, 2));
  });

  test('默认排序（不传order参数）', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/favorites/folders/${FOLDER_ID}?page=1&page_size=5`
    );
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('medias');
    
    console.log('默认排序结果:', JSON.stringify(data, null, 2));
  });
});

test.describe('收藏页前端组件测试', () => {
  test('收藏页应该显示搜索和排序控件', async ({ page }) => {
    // 导航到收藏页
    await page.goto('http://localhost:5173/favorites');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    
    // 检查是否有搜索框
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeVisible();
    
    // 检查是否有排序选择器
    const sortSelect = page.locator('.sort-select');
    await expect(sortSelect).toBeVisible();
    
    // 检查是否有排序方向按钮
    const sortDirectionBtn = page.locator('.sort-direction-btn');
    await expect(sortDirectionBtn).toBeVisible();
  });

  test('收藏页排序选项应该包含"按收藏时间"', async ({ page }) => {
    // 导航到收藏页
    await page.goto('http://localhost:5173/favorites');
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    
    // 点击一个收藏夹进入详情页
    const firstFolder = page.locator('.folder-item').first();
    await firstFolder.click();
    
    // 等待详情页加载
    await page.waitForLoadState('networkidle');
    
    // 检查排序选项
    const sortSelect = page.locator('.sort-select');
    const options = await sortSelect.locator('option').allTextContents();
    
    // 验证包含"按收藏时间"选项
    expect(options).toContain('按收藏时间');
    expect(options).toContain('按播放量');
    expect(options).toContain('按发布时间');
    expect(options).toContain('默认');
  });
});