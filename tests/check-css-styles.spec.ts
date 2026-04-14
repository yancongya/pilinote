import { test, expect } from '@playwright/test';

test('检查CSS样式', async ({ page }) => {
  // 直接读取CSS文件内容
  const cssContent = await page.evaluate(async () => {
    const response = await fetch('/src/components/NewDownload/index.css');
    return await response.text();
  });
  
  // 检查video-info的样式
  const videoInfoMatch = cssContent.match(/\.video-info\s*{([^}]+)}/);
  if (videoInfoMatch) {
    console.log('video-info样式:', videoInfoMatch[1]);
    
    // 检查是否包含display和flex-direction
    const hasDisplay = videoInfoMatch[1].includes('display');
    const hasFlexDirection = videoInfoMatch[1].includes('flex-direction');
    
    console.log('包含display:', hasDisplay);
    console.log('包含flex-direction:', hasFlexDirection);
  }
  
  // 检查video-meta的样式
  const videoMetaMatch = cssContent.match(/\.video-meta\s*{([^}]+)}/);
  if (videoMetaMatch) {
    console.log('video-meta样式:', videoMetaMatch[1]);
    
    // 检查是否包含display
    const hasDisplay = videoMetaMatch[1].includes('display');
    console.log('video-meta包含display:', hasDisplay);
  }
  
  // 检查是否有新的样式规则
  const newStyleMatch = cssContent.match(/\/\* 文件夹视频列表 \*\/([\s\S]*?)\/\*/);
  if (newStyleMatch) {
    console.log('找到新的样式规则:', newStyleMatch[1]);
  }
});