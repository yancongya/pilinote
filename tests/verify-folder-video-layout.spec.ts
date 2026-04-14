import { test, expect } from '@playwright/test';

test('验证文件夹视频列表布局', async ({ page }) => {
  // 访问页面
  await page.goto('http://localhost:5173');
  
  // 等待页面加载
  await page.waitForTimeout(2000);
  
  // 点击"新下载"tab
  await page.getByRole('tab', { name: '新下载' }).click();
  
  // 等待页面加载
  await page.waitForTimeout(2000);
  
  // 点击"视频库"tab
  await page.getByRole('tab', { name: '视频库' }).click();
  
  // 等待内容加载
  await page.waitForTimeout(2000);
  
  // 点击刷新按钮
  const refreshButton = page.locator('button').filter({ hasText: '刷新' });
  if (await refreshButton.count() > 0) {
    await refreshButton.click();
    await page.waitForTimeout(3000);
  }
  
  // 查找多视频文件夹
  const folderCards = page.locator('.folder-card');
  const cardCount = await folderCards.count();
  
  console.log(`找到 ${cardCount} 个文件夹卡片`);
  
  if (cardCount > 0) {
    // 查找多视频文件夹
    const firstCard = folderCards.first();
    const expandIcon = firstCard.locator('.folder-expand-icon');
    
    if (await expandIcon.count() > 0) {
      // 点击文件夹卡片头部来展开
      const cardHeader = firstCard.locator('.folder-card-header');
      await cardHeader.click();
      await page.waitForTimeout(1000);
      
      // 检查video-info样式
      const videoInfo = page.locator('.folder-video-item .video-info').first();
      const infoDisplay = await videoInfo.evaluate(el => {
        return window.getComputedStyle(el).display;
      });
      const infoFlexDirection = await videoInfo.evaluate(el => {
        return window.getComputedStyle(el).flexDirection;
      });
      
      console.log(`video-info display: ${infoDisplay}`);
      console.log(`video-info flexDirection: ${infoFlexDirection}`);
      
      // 检查video-meta样式
      const videoMeta = page.locator('.folder-video-item .video-meta').first();
      const metaDisplay = await videoMeta.evaluate(el => {
        return window.getComputedStyle(el).display;
      });
      const metaAlignItems = await videoMeta.evaluate(el => {
        return window.getComputedStyle(el).alignItems;
      });
      
      console.log(`video-meta display: ${metaDisplay}`);
      console.log(`video-meta alignItems: ${metaAlignItems}`);
      
      // 截图
      await page.screenshot({ path: 'folder-video-layout.png', fullPage: true });
      console.log('截图已保存');
    }
  }
});