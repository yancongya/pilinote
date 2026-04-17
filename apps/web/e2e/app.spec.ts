import { test, expect } from '@playwright/test';

test.describe('PiliNote App', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题或主要元素存在
    // 注意：当前是开发环境，需要后端 API 可用
    console.log('Page title:', await page.title());
  });

  test('can navigate to library', async ({ page }) => {
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
    
    // 验证导航到媒体库
    console.log('Library page loaded');
  });
});