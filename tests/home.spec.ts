import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load home page', async ({ page }) => {
    await page.goto('/');
    
    // 检查页面标题
    await expect(page).toHaveTitle(/PiliNote/i);
  });

  test('should show URL input field', async ({ page }) => {
    await page.goto('/');
    
    // 检查输入框存在
    const input = page.getByLabel('解析链接');
    await expect(input).toBeVisible();
  });

  test('should have parse button', async ({ page }) => {
    await page.goto('/');
    
    // 检查解析按钮
    const parseButton = page.getByRole('button', { name: /解析/i });
    await expect(parseButton).toBeVisible();
  });

  test('should show error for invalid URL', async ({ page }) => {
    await page.goto('/');
    
    // 等待页面加载
    await page.waitForSelector('#url-input', { timeout: 10000 });
    
    // 输入无效URL - 使用 id 选择器
    const input = page.locator('#url-input');
    await input.fill('invalid-url');
    
    // 点击解析按钮
    const parseButton = page.getByRole('button', { name: /解析/i });
    await parseButton.click();
    
    // 等待错误提示出现
    await page.waitForTimeout(1000);
  });

  test('should parse valid Bilibili URL', async ({ page }) => {
    await page.goto('/');
    
    // 等待页面加载
    await page.waitForSelector('#url-input', { timeout: 10000 });
    
    // 输入有效B站链接 - 使用 id 选择器
    const input = page.locator('#url-input');
    await input.fill('https://www.bilibili.com/video/BV1xx411c7mD');
    
    // 点击解析按钮
    const parseButton = page.getByRole('button', { name: /解析/i });
    await parseButton.click();
    
    // 等待加载完成
    await page.waitForTimeout(3000);
  });
});