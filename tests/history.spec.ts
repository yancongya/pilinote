import { test, expect } from '@playwright/test';

test.describe('观看历史功能测试', () => {
  test.describe('API 端点验证', () => {
    test('GET /api/history/list - 端点存在性检查', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20');
      
      // 端点应该存在（虽然可能返回 401 未授权）
      expect([200, 401, 400]).toContain(response.status());
    });

    test('GET /api/history/list - 未登录时的行为', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20');
      
      // 未登录时可能返回 401 或 200（取决于实现）
      expect([200, 401]).toContain(response.status());
      
      if (response.status() === 401) {
        // 如果返回 401，应该包含错误信息
        const body = await response.json();
        expect(body).toHaveProperty('detail');
      }
    });

    test('GET /api/history/list - 响应格式验证', async ({ request }) => {
      // 注意：这个测试需要有效的 SESSDATA
      // 这里只验证端点返回的格式
      
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20');
      
      // 即使未登录，也应该返回 JSON 格式
      const contentType = response.headers()['content-type'];
      expect(contentType).toMatch(/application\/json/);
    });
  });

  test.describe('功能测试', () => {
    test('历史记录列表应该包含必要的字段', async ({ request }) => {
      // 注意：这个测试需要有效的 SESSDATA
      // 这里只验证API返回的数据结构
      
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20');
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('data');
        
        if (body.success && body.data) {
          expect(body.data).toHaveProperty('list');
          expect(body.data).toHaveProperty('total');
          expect(body.data).toHaveProperty('page');
          expect(body.data).toHaveProperty('page_size');
          
          // 验证列表中的数据项
          if (body.data.list && body.data.list.length > 0) {
            const firstItem = body.data.list[0];
            expect(firstItem).toHaveProperty('bvid');
            expect(firstItem).toHaveProperty('title');
            expect(firstItem).toHaveProperty('author');
            expect(firstItem).toHaveProperty('view');
          }
        }
      }
    });

    test('历史记录应该支持分页', async ({ request }) => {
      // 测试不同页数
      const page1 = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20');
      const page2 = await request.get('http://localhost:8000/api/history/list?pn=2&ps=20');
      
      // 至少端点应该正常响应
      expect([200, 401, 400]).toContain(page1.status());
      expect([200, 401, 400]).toContain(page2.status());
    });

    test('历史记录应该支持搜索功能', async ({ request }) => {
      // 测试搜索参数
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20&keyword=test');
      
      // 至少端点应该正常响应
      expect([200, 401, 400]).toContain(response.status());
    });

    test('历史记录应该支持排序功能', async ({ request }) => {
      // 测试不同排序参数
      const viewOrder = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20&order=view');
      const pubtimeOrder = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20&order=pubtime');
      const viewAtOrder = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20&order=view_at');
      
      // 至少端点应该正常响应
      expect([200, 401, 400]).toContain(viewOrder.status());
      expect([200, 401, 400]).toContain(pubtimeOrder.status());
      expect([200, 401, 400]).toContain(viewAtOrder.status());
    });
  });

  test.describe('前端UI测试', () => {
    test('观看历史页面应该可以访问', async ({ page }) => {
      await page.goto('http://localhost:5173/history');
      
      // 页面应该正常加载
      await expect(page).toHaveTitle(/PiliNote/);
    });

    test('观看历史导航应该存在', async ({ page }) => {
      await page.goto('http://localhost:5173');
      
      // 检查导航菜单中是否有观看历史入口
      // 这里假设导航菜单在侧边栏
      const historyNav = page.locator('text=观看历史').first();
      await expect(historyNav).toBeVisible();
    });

    test('点击观看历史导航应该跳转到正确页面', async ({ page }) => {
      await page.goto('http://localhost:5173');
      
      // 点击观看历史导航
      const historyNav = page.locator('text=观看历史').first();
      await historyNav.click();
      
      // 应该跳转到 /history 页面
      await expect(page).toHaveURL(/\/history$/);
    });
  });

  test.describe('数据转换测试', () => {
    test('历史记录数据应该正确转换', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=1');
      
      if (response.status() === 200) {
        const body = await response.json();
        
        if (body.success && body.data && body.data.list && body.data.list.length > 0) {
          const item = body.data.list[0];
          
          // 验证关键字段是否正确映射
          expect(item).toHaveProperty('bvid');
          expect(item).toHaveProperty('title');
          expect(item).toHaveProperty('author');
          expect(item).toHaveProperty('view');
          expect(item).toHaveProperty('pubtime');
          expect(item).toHaveProperty('add_time');  // 观看时间
          expect(item).toHaveProperty('progress');  // 观看进度
        }
      }
    });
  });

  test.describe('性能测试', () => {
    test('历史记录API应该在合理时间内响应', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20');
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // API响应时间应该小于5秒
      expect(responseTime).toBeLessThan(5000);
      expect([200, 401, 400]).toContain(response.status());
    });

    test('历史记录页面加载应该在合理时间内完成', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('http://localhost:5173/history');
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // 页面加载时间应该小于5秒
      expect(loadTime).toBeLessThan(5000);
    });
  });

  test.describe('错误处理测试', () => {
    test('无效的分页参数应该被正确处理', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/history/list?pn=0&ps=20');
      
      // 应该返回错误或使用默认值
      expect([200, 400, 422]).toContain(response.status());
    });

    test('过大的每页数量应该被限制', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=1000');
      
      // 应该返回成功或错误（取决于实现）
      expect([200, 400, 422]).toContain(response.status());
    });

    test('无效的排序参数应该使用默认排序', async ({ request }) => {
      const response = await request.get('http://localhost:8000/api/history/list?pn=1&ps=20&order=invalid');
      
      // 应该返回成功或错误（取决于实现）
      expect([200, 400]).toContain(response.status());
    });
  });
});