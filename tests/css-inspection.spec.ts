import { test, expect } from '@playwright/test';

test('检查CSS选择器优先级', async ({ page }) => {
  // 读取构建后的CSS文件
  const cssContent = await page.evaluate(async () => {
    const response = await fetch('/dist/assets/index-Dr0vB7aq.css');
    return await response.text();
  });
  
  // 查找.folder-video-item相关的样式
  const folderVideoItemMatches = cssContent.matchAll(/\.folder-video-item[^{]*{([^}]+)}/g);
  const folderVideoItemStyles = [];
  
  for (const match of folderVideoItemMatches) {
    folderVideoItemStyles.push(match[1]);
  }
  
  console.log(`找到 ${folderVideoItemStyles.length} 个.folder-video-item样式定义`);
  folderVideoItemStyles.forEach((style, i) => {
    console.log(`\n样式 ${i + 1}:`);
    console.log(style);
  });
  
  // 查找.video-info相关的样式
  const videoInfoMatches = cssContent.matchAll(/\.video-info[^{]*{([^}]+)}/g);
  const videoInfoStyles = [];
  
  for (const match of videoInfoMatches) {
    videoInfoStyles.push(match[1]);
  }
  
  console.log(`\n找到 ${videoInfoStyles.length} 个.video-info样式定义`);
  videoInfoStyles.forEach((style, i) => {
    console.log(`\n样式 ${i + 1}:`);
    console.log(style);
  });
  
  // 查找.video-meta相关的样式
  const videoMetaMatches = cssContent.matchAll(/\.video-meta[^{]*{([^}]+)}/g);
  const videoMetaStyles = [];
  
  for (const match of videoMetaMatches) {
    videoMetaStyles.push(match[1]);
  }
  
  console.log(`\n找到 ${videoMetaStyles.length} 个.video-meta样式定义`);
  videoMetaStyles.forEach((style, i) => {
    console.log(`\n样式 ${i + 1}:`);
    console.log(style);
  });
  
  // 检查是否有.folder-video-item .video-info这样的嵌套选择器
  const nestedSelectors = cssContent.match(/\.folder-video-item\s+\.video-info[^{]*{([^}]+)}/g);
  if (nestedSelectors) {
    console.log(`\n找到 ${nestedSelectors.length} 个嵌套选择器 .folder-video-item .video-info`);
    nestedSelectors.forEach((selector, i) => {
      console.log(`\n嵌套选择器 ${i + 1}:`);
      console.log(selector);
    });
  } else {
    console.log('\n没有找到嵌套选择器 .folder-video-item .video-info');
  }
});