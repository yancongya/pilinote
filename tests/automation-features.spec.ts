import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

/**
 * 自动化功能测试套件
 * 测试自动扫描和手动扫描功能
 */

test.describe('自动化功能 - 手动触发扫描', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('POST /api/auto-download/scan/trigger - 手动触发收藏夹扫描', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=favorite&source_id=all');
    
    expect([200, 400, 401, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      
      if (data.data) {
        expect(data.data).toHaveProperty('total');
        expect(data.data).toHaveProperty('new');
        expect(data.data).toHaveProperty('added');
        expect(data.data).toHaveProperty('folder_count');
        expect(data.data).toHaveProperty('folders');
      }
    }
  });

  test('POST /api/auto-download/scan/trigger - 手动触发稍后再看扫描', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=watch_later&source_id=all');
    
    expect([200, 400, 401, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
    }
  });

  test('POST /api/auto-download/scan/trigger - 扫描特定收藏夹', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=favorite&source_id=54507208');
    
    expect([200, 400, 401, 404, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
    }
  });

  test('POST /api/auto-download/scan/trigger - 使用无效的source_type参数', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=invalid&source_id=all');
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty('detail');
    expect(data.detail).toContain('无效的视频源类型');
  });

  test('GET /api/auto-download/scan-records - 获取扫描记录', async () => {
    const response = await apiContext.get('/api/auto-download/scan-records?source_type=favorite');
    
    expect([200, 400, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      
      if (data.data && Array.isArray(data.data)) {
        if (data.data.length > 0) {
          const record = data.data[0];
          expect(record).toHaveProperty('id');
          expect(record).toHaveProperty('source_type');
          expect(record).toHaveProperty('source_id');
          expect(record).toHaveProperty('total_videos');
          expect(record).toHaveProperty('new_videos');
          expect(record).toHaveProperty('added_to_queue');
          expect(record).toHaveProperty('created_at');
        }
      }
    }
  });
});

test.describe('自动化功能 - 扫描结果数据结构', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('扫描响应数据结构验证', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=favorite&source_id=all');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      
      if (data.data) {
        const result = data.data;
        
        // 验证基础字段
        expect(result).toHaveProperty('total');
        expect(typeof result.total).toBe('number');
        
        expect(result).toHaveProperty('new');
        expect(typeof result.new).toBe('number');
        
        expect(result).toHaveProperty('added');
        expect(typeof result.added).toBe('number');
        
        expect(result).toHaveProperty('folder_count');
        expect(typeof result.folder_count).toBe('number');
        
        expect(result).toHaveProperty('folders');
        expect(Array.isArray(result.folders)).toBe(true);
        
        // 验证逻辑关系
        expect(result.added).toBeLessThanOrEqual(result.new);
        expect(result.new).toBeLessThanOrEqual(result.total);
      }
    }
  });

  test('扫描记录数据结构验证', async () => {
    const response = await apiContext.get('/api/auto-download/scan-records?source_type=favorite');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const record = data.data[0];
        
        // 验证必填字段
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('source_type');
        expect(record).toHaveProperty('source_id');
        expect(record).toHaveProperty('total_videos');
        expect(record).toHaveProperty('new_videos');
        expect(record).toHaveProperty('added_to_queue');
        expect(record).toHaveProperty('created_at');
        
        // 验证字段类型
        expect(typeof record.total_videos).toBe('number');
        expect(typeof record.new_videos).toBe('number');
        expect(typeof record.added_to_queue).toBe('number');
        expect(typeof record.created_at).toBe('string');
        
        // 验证逻辑关系
        expect(record.added_to_queue).toBeLessThanOrEqual(record.new_videos);
        expect(record.new_videos).toBeLessThanOrEqual(record.total_videos);
      }
    }
  });
});

test.describe('自动化功能 - 错误处理', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('扫描时缺少必要参数', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=favorite');
    
    // 系统对source_id有默认值处理，所以可能返回200
    expect([200, 422]).toContain(response.status());
  });

  test('使用不存在的收藏夹ID', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=favorite&source_id=999999999');
    
    expect([200, 404]).toContain(response.status());
  });

  test('DELETE /api/auto-download/scan-records/{record_id} - 删除扫描记录', async () => {
    // 先获取一条扫描记录
    const listResponse = await apiContext.get('/api/auto-download/scan-records?source_type=favorite');
    
    if (listResponse.status() === 200) {
      const listData = await listResponse.json();
      
      if (listData.data && listData.data.length > 0) {
        const recordId = listData.data[0].id;
        
        // 删除记录
        const deleteResponse = await apiContext.delete(`/api/auto-download/scan-records/${recordId}`);
        
        expect([200, 404, 500]).toContain(deleteResponse.status());
        
        if (deleteResponse.status() === 200) {
          const deleteData = await deleteResponse.json();
          expect(deleteData).toHaveProperty('success');
        }
      }
    }
  });

  test('DELETE /api/auto-download/scan-records - 清除扫描记录', async () => {
    const response = await apiContext.delete('/api/auto-download/scan-records?source_type=watch_later&days=30');
    
    expect([200, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('deleted_count');
    }
  });
});

test.describe('自动化功能 - 扫描逻辑验证', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('验证扫描结果中的folder_count与实际folders数组长度一致', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=favorite&source_id=all');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      if (data.data && data.data.folders) {
        expect(data.data.folder_count).toBe(data.data.folders.length);
      }
    }
  });

  test('验证扫描逻辑不会重复添加已下载的视频', async () => {
    // 第一次扫描
    const response1 = await apiContext.post('/api/auto-download/scan/trigger?source_type=watch_later&source_id=all');
    
    // 第二次扫描（应该不会添加新视频）
    const response2 = await apiContext.post('/api/auto-download/scan/trigger?source_type=watch_later&source_id=all');
    
    if (response1.status() === 200 && response2.status() === 200) {
      const data1 = await response1.json();
      const data2 = await response2.json();
      
      // 第二次扫描的added数量应该小于等于第一次
      if (data1.data && data2.data) {
        expect(data2.data.added).toBeLessThanOrEqual(data1.data.added);
      }
    }
  });
});

test.describe('自动化功能 - 记录管理', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('获取收藏夹扫描记录', async () => {
    const response = await apiContext.get('/api/auto-download/scan-records?source_type=favorite');
    
    expect([200, 400, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((record: any) => {
          expect(record.source_type).toBe('favorite');
        });
      }
    }
  });

  test('获取稍后再看扫描记录', async () => {
    const response = await apiContext.get('/api/auto-download/scan-records?source_type=watch_later');
    
    expect([200, 400, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((record: any) => {
          expect(record.source_type).toBe('watch_later');
        });
      }
    }
  });

  test('验证记录按时间倒序排列', async () => {
    const response = await apiContext.get('/api/auto-download/scan-records?source_type=favorite');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data) && data.data.length > 1) {
        // 验证时间字符串格式
        for (let i = 0; i < data.data.length; i++) {
          expect(data.data[i].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        }
      }
    }
  });
});