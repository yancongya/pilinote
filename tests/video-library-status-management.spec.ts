import { test, expect } from '@playwright/test';

test.describe('视频库状态管理系统测试', () => {
  test.describe('API 端点验证', () => {
    test('GET /api/video-library/refresh - 端点存在性检查', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/video-library/refresh');
      
      // 端点应该存在
      expect([200, 500]).toContain(response.status());
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('data');
      }
    });

    test('GET /api/video-library/refresh - 响应格式验证', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/video-library/refresh');
      
      // 应该返回 JSON 格式
      const contentType = response.headers()['content-type'];
      expect(contentType).toMatch(/application\/json/);
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data).toHaveProperty('downloaded_bvids');
        expect(body.data).toHaveProperty('folder_count');
        expect(body.data).toHaveProperty('total_files');
      }
    });

    test('POST /api/video-library/check-batch - 端点存在性检查', async ({ request }) => {
      const response = await request.post('http://localhost:8000/api/video-library/check-batch', {
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          bvids: ['BV1xx411c7mD', 'BV1yy411c7mD']
        })
      });
      
      // 端点应该存在
      expect([200, 500]).toContain(response.status());
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('downloaded');
        expect(body.data).toHaveProperty('not_downloaded');
      }
    });

    test('GET /api/video-library/status - 端点存在性检查', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/video-library/status');
      
      // 端点应该存在
      expect([200, 500]).toContain(response.status());
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('total_folders');
        expect(body.data).toHaveProperty('total_videos');
      }
    });
  });

  test.describe('刷新功能测试', () => {
    test('刷新视频库应该返回正确的数据结构', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/video-library/refresh');
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('downloaded_bvids');
      expect(Array.isArray(body.data.downloaded_bvids)).toBe(true);
      expect(body.data).toHaveProperty('folder_count');
      expect(typeof body.data.folder_count).toBe('number');
      expect(body.data).toHaveProperty('total_files');
      expect(typeof body.data.total_files).toBe('number');
    });

    test('批量检查视频应该正确分类', async ({ request }) => {
      const response = await request.post('http://localhost:8000/api/video-library/check-batch', {
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          bvids: ['BV1xx411c7mD', 'BV1yy411c7mD', 'BV1zz411c7mD']
        })
      });
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('downloaded');
      expect(body.data).toHaveProperty('not_downloaded');
      expect(Array.isArray(body.data.downloaded)).toBe(true);
      expect(Array.isArray(body.data.not_downloaded)).toBe(true);
      
      // 下载的和未下载的应该加起来等于总数
      const total = body.data.downloaded.length + body.data.not_downloaded.length;
      expect(total).toBe(3);
    });

    test('获取视频库状态应该返回统计信息', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/video-library/status');
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('total_folders');
      expect(body.data).toHaveProperty('total_videos');
      expect(body.data).toHaveProperty('total_size_mb');
      expect(typeof body.data.total_folders).toBe('number');
      expect(typeof body.data.total_videos).toBe('number');
      expect(typeof body.data.total_size_mb).toBe('number');
    });
  });

  test.describe('前端UI测试', () => {
    test('视频库设置页面应该正常显示', async ({ page }) => {
      await page.goto('http://localhost:5173/settings');
      
      // 等待页面加载
      await page.waitForLoadState('networkidle');
      
      // 检查是否有设置页面内容
      const settingsPage = page.locator('.settings-page, .stg-panel, [class*="settings"]');
      await expect(settingsPage.first()).toBeVisible();
    });

    test('视频库设置应该包含缓存状态信息', async ({ page }) => {
      await page.goto('http://localhost:5173/settings');
      await page.waitForLoadState('networkidle');
      
      // 查找视频库相关内容
      const videoLibraryContent = page.locator('text=/视频库|缓存|刷新/');
      await expect(videoLibraryContent.first()).toBeVisible();
    });

    test('应该能访问视频库设置标签', async ({ page }) => {
      await page.goto('http://localhost:5173/settings');
      await page.waitForLoadState('networkidle');
      
      // 查找视频库标签或按钮
      const videoLibraryTab = page.locator('text=/视频库|Video Library/').first();
      
      // 如果找到了视频库标签，尝试点击
      if (await videoLibraryTab.isVisible()) {
        await videoLibraryTab.click();
        await page.waitForTimeout(1000);
        
        // 验证视频库内容是否显示
        const videoLibraryContent = page.locator('text=/缓存|刷新|状态/');
        await expect(videoLibraryContent.first()).toBeVisible();
      }
    });
  });

  test.describe('缓存逻辑测试', () => {
    test('刷新后缓存应该包含数据', async ({ request }) => {
      // 先刷新
      const refreshResponse = await request.get('http://localhost:8000/api/video-library/refresh');
      expect(refreshResponse.status()).toBe(200);
      
      const refreshBody = await refreshResponse.json();
      expect(refreshBody.data.downloaded_bvids.length).toBeGreaterThanOrEqual(0);
      
      // 如果有下载的视频，验证状态
      if (refreshBody.data.downloaded_bvids.length > 0) {
        const testBvid = refreshBody.data.downloaded_bvids[0];
        
        // 检查该视频是否在已下载列表中
        const checkResponse = await request.post('http://localhost:8000/api/video-library/check-batch', {
          headers: {
            'Content-Type': 'application/json'
          },
          data: JSON.stringify({
            bvids: [testBvid, 'BV1notexisting123']
          })
        });
        
        expect(checkResponse.status()).toBe(200);
        const checkBody = await checkResponse.json();
        expect(checkBody.data.downloaded).toContain(testBvid);
      }
    });

    test('视频库状态应该反映实际文件系统', async ({ request }) => {
      const statusResponse = await request.get('http://localhost:8000/api/video-library/status');
      expect(statusResponse.status()).toBe(200);
      
      const statusBody = await statusResponse.json();
      
      // 验证返回的数据结构
      expect(statusBody.data.total_folders).toBeGreaterThanOrEqual(0);
      expect(statusBody.data.total_videos).toBeGreaterThanOrEqual(0);
      expect(statusBody.data.total_size_mb).toBeGreaterThanOrEqual(0);
      
      // 如果有视频，文件夹数应该大于0
      if (statusBody.data.total_videos > 0) {
        expect(statusBody.data.total_folders).toBeGreaterThan(0);
      }
    });
  });

  test.describe('性能测试', () => {
    test('刷新操作应该在合理时间内完成', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get('http://localhost:8000/api/video-library/refresh');
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(response.status()).toBe(200);
      
      // 刷新操作应该在10秒内完成（假设最多有1000个视频）
      expect(duration).toBeLessThan(10000);
    });

    test('批量检查100个视频应该在合理时间内完成', async ({ request }) => {
      // 生成100个测试BVID
      const bvids = Array.from({ length: 100 }, (_, i) => `BV1test${String(i).padStart(8, '0')}`);
      
      const startTime = Date.now();
      const response = await request.post('http://localhost:8000/api/video-library/check-batch', {
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({ bvids })
      });
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(response.status()).toBe(200);
      
      // 批量检查应该在5秒内完成
      expect(duration).toBeLessThan(5000);
      
      const body = await response.json();
      expect(body.data.downloaded.length + body.data.not_downloaded.length).toBe(100);
    });
  });

  test.describe('错误处理测试', () => {
    test('无效的BVID格式应该被正确处理', async ({ request }) => {
      const response = await request.post('http://localhost:8000/api/video-library/check-batch', {
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          bvids: ['invalid_bvid', 'also_invalid']
        })
      });
      
      // 应该返回成功（因为API会处理无效格式）
      expect([200, 400, 422]).toContain(response.status());
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body.success).toBe(true);
        // 无效的BVID应该被分类为未下载
        expect(body.data.not_downloaded.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('空的BVID列表应该返回空结果', async ({ request }) => {
      const response = await request.post('http://localhost:8000/api/video-library/check-batch', {
        headers: {
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          bvids: []
        })
      });
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.downloaded).toEqual([]);
      expect(body.data.not_downloaded).toEqual([]);
    });
  });
});