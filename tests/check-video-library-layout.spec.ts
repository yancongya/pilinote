import { test, expect } from '@playwright/test';

test('检查视频库布局', async ({ page }) => {
  // 访问页面
  await page.goto('http://localhost:5173');
  
  // 等待页面加载
  await page.waitForTimeout(2000);
  
  // 先点击侧边栏的"新下载"tab（使用role和name）
  const newDownloadTab = page.getByRole('tab', { name: '新下载' });
  await newDownloadTab.click();
  
  // 等待新下载页面加载
  await page.waitForTimeout(2000);
  
  // 点击侧边栏的"视频库"tab
  const videoLibraryTab = page.getByRole('tab', { name: '视频库' });
  await videoLibraryTab.click();
  
  // 等待内容加载
  await page.waitForTimeout(2000);
  
  // 检查是否存在文件夹卡片
  const folderCards = page.locator('.folder-card');
  const cardCount = await folderCards.count();
  console.log(`找到 ${cardCount} 个文件夹卡片`);
  
  if (cardCount > 0) {
    // 检查第一个文件夹卡片
    const firstCard = folderCards.first();
    
    // 获取video-info元素的样式
    const videoInfo = firstCard.locator('.video-info');
    const infoCount = await videoInfo.count();
    console.log(`找到 ${infoCount} 个video-info元素`);
    
    if (infoCount > 0) {
      // 检查display属性
      const display = await videoInfo.first().evaluate(el => {
        return window.getComputedStyle(el).display;
      });
      console.log(`video-info display属性: ${display}`);
      
      // 检查flexDirection属性
      const flexDirection = await videoInfo.first().evaluate(el => {
        return window.getComputedStyle(el).flexDirection;
      });
      console.log(`video-info flexDirection属性: ${flexDirection}`);
      
      // 获取video-meta元素的样式
      const videoMeta = firstCard.locator('.video-meta');
      const metaCount = await videoMeta.count();
      console.log(`找到 ${metaCount} 个video-meta元素`);
      
      if (metaCount > 0) {
        // 检查display属性
        const metaDisplay = await videoMeta.first().evaluate(el => {
          return window.getComputedStyle(el).display;
        });
        console.log(`video-meta display属性: ${metaDisplay}`);
        
        // 获取video-meta中的元素数量
        const children = await videoMeta.first().locator('*').count();
        console.log(`video-meta中有 ${children} 个子元素`);
        
        // 检查每个子元素的显示方式
        for (let i = 0; i < children; i++) {
          const child = videoMeta.first().locator('*').nth(i);
          const childDisplay = await child.evaluate(el => {
            return window.getComputedStyle(el).display;
          });
          console.log(`video-meta子元素 ${i} display属性: ${childDisplay}`);
        }
      }
    }
    
    // 截图保存
    await page.screenshot({ path: 'video-library-layout.png', fullPage: true });
    console.log('截图已保存到 video-library-layout.png');
  }
});