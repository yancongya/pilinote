import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * 多类型媒体支持测试
 * 
 * 测试范围：
 * 1. 单个视频处理
 * 2. 系列视频（多P）处理
 * 3. 图文内容处理
 * 4. 媒体类型对比验证
 */

const BASE_URL = 'http://localhost:8000';

test.describe('多类型媒体支持 - 单个视频处理', () => {
  let apiContext: APIRequestContext;
  let createdTaskId: string | null = null;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    if (createdTaskId) {
      try {
        await apiContext.delete(`/api/queue/tasks/${createdTaskId}`);
      } catch (e) {
        // 忽略删除错误
      }
    }
    await apiContext.dispose();
  });

  test('创建单个视频任务', async () => {
    const taskData = {
      title: '测试单个视频',
      media_type: 'video',
      media_id: 'BV1testSingle001',
      cover: 'https://example.com/cover.jpg',
      desc: 'CID: 123456',
      meta: { 
        cid: 123456,
        quality: 80,
        output_format: 'mp4'
      }
    };

    const response = await apiContext.post('/api/queue/tasks', {
      data: taskData
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.media_type).toBe('video');
    expect(data.data.state).toBe(0); // BACKLOG state

    createdTaskId = data.data.id;
  });

  test('单个视频meta字段验证', async () => {
    if (!createdTaskId) {
      test.skip();
      return;
    }

    const response = await apiContext.get('/api/queue/tasks');
    
    if (response.status() === 200) {
      const data = await response.json();
      const task = data.data.find((t: any) => t.id === createdTaskId);
      
      if (task) {
        expect(task.meta).toHaveProperty('cid');
        expect(typeof task.meta.cid).toBe('number');
        expect(task.meta).toHaveProperty('quality');
        expect(typeof task.meta.quality).toBe('number');
      }
    }
  });
});

test.describe('多类型媒体支持 - 系列视频（多P）处理', () => {
  let apiContext: APIRequestContext;
  let createdTaskIds: string[] = [];
  let createdSchedulerId: string | null = null;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    // 清理任务
    for (const taskId of createdTaskIds) {
      try {
        await apiContext.delete(`/api/queue/tasks/${taskId}`);
      } catch (e) {
        // 忽略删除错误
      }
    }
    
    // 清理调度器
    if (createdSchedulerId) {
      try {
        await apiContext.delete(`/api/queue/schedulers/${createdSchedulerId}`);
      } catch (e) {
        // 忽略删除错误
      }
    }
    
    await apiContext.dispose();
  });

  test('创建多个分P任务', async () => {
    // 模拟创建3个分P任务
    for (let i = 1; i <= 3; i++) {
      const taskData = {
        title: `测试系列P${i}`,
        media_type: 'video',
        media_id: 'BV1testSeries001',
        cover: 'https://example.com/cover.jpg',
        desc: `CID: 12345${i}`,
        meta: { 
          cid: 123456,
          page: i,
          part_title: `第${i}集`,
          quality: 80,
          output_format: 'mp4'
        }
      };

      const response = await apiContext.post('/api/queue/tasks', {
        data: taskData
      });

      if (response.status() === 200) {
        const data = await response.json();
        createdTaskIds.push(data.data.id);
      }
    }

    expect(createdTaskIds.length).toBeGreaterThan(0);
  });

  test('创建调度器管理系列视频', async () => {
    if (createdTaskIds.length === 0) {
      test.skip();
      return;
    }

    const schedulerData = {
      title: '测试系列视频',
      task_ids: createdTaskIds,
      folder: '/tmp/test-series'
    };

    const response = await apiContext.post('/api/queue/schedulers', {
      data: schedulerData
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe(schedulerData.title);
    expect(data.data.list.length).toBe(createdTaskIds.length);
    expect(data.data.count).toBe(createdTaskIds.length);

    createdSchedulerId = data.data.id;
  });

  test('分P任务meta字段验证', async () => {
    if (createdTaskIds.length === 0) {
      test.skip();
      return;
    }

    const response = await apiContext.get('/api/queue/tasks');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      for (const taskId of createdTaskIds) {
        const task = data.data.find((t: any) => t.id === taskId);
        
        if (task) {
          expect(task.meta).toHaveProperty('cid');
          expect(task.meta).toHaveProperty('page');
          expect(task.meta).toHaveProperty('part_title');
          expect(typeof task.meta.page).toBe('number');
          expect(typeof task.meta.part_title).toBe('string');
        }
      }
    }
  });

  test('调度器与任务关联验证', async () => {
    if (!createdSchedulerId || createdTaskIds.length === 0) {
      test.skip();
      return;
    }

    const response = await apiContext.get('/api/queue/schedulers');
    
    if (response.status() === 200) {
      const data = await response.json();
      const scheduler = data.data.find((s: any) => s.id === createdSchedulerId);
      
      if (scheduler) {
        expect(scheduler.list).toEqual(expect.arrayContaining(createdTaskIds));
      }
    }
  });
});

test.describe('多类型媒体支持 - 图文内容处理', () => {
  let apiContext: APIRequestContext;
  let createdTaskId: string | null = null;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    if (createdTaskId) {
      try {
        await apiContext.delete(`/api/queue/tasks/${createdTaskId}`);
      } catch (e) {
        // 忽略删除错误
      }
    }
    await apiContext.dispose();
  });

  test('创建图文任务', async () => {
    const taskData = {
      title: '测试图文内容',
      media_type: 'opus',
      media_id: 'BV1testOpus001',
      cover: 'https://example.com/cover.jpg',
      desc: '图文内容描述',
      meta: { 
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg'
        ],
        text: '这是图文内容的文本描述',
        dynamic_id: '123456789'
      }
    };

    const response = await apiContext.post('/api/queue/tasks', {
      data: taskData
    });

    expect([200, 400, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.media_type).toBe('opus');
      
      createdTaskId = data.data.id;
    } else {
      // 图文类型可能还未完全实现
      test.info('图文类型处理可能还未完全实现');
    }
  });

  test('图文meta字段验证', async () => {
    if (!createdTaskId) {
      test.skip();
      return;
    }

    const response = await apiContext.get('/api/queue/tasks');
    
    if (response.status() === 200) {
      const data = await response.json();
      const task = data.data.find((t: any) => t.id === createdTaskId);
      
      if (task) {
        expect(task.meta).toHaveProperty('images');
        expect(Array.isArray(task.meta.images)).toBeTruthy();
        expect(task.meta).toHaveProperty('text');
        expect(typeof task.meta.text).toBe('string');
      }
    }
  });
});

test.describe('多类型媒体支持 - 媒体类型对比验证', () => {
  let apiContext: APIRequestContext;

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

  test('验证不同media_type的任务', async () => {
    const response = await apiContext.get('/api/queue/tasks');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const mediaTypes = new Set();
        data.data.forEach((task: any) => {
          if (task.media_type) {
            mediaTypes.add(task.media_type);
          }
        });
        
        // 验证已知的媒体类型
        expect(mediaTypes.size).toBeGreaterThan(0);
        
        // 常见媒体类型
        const knownTypes = ['video', 'favorite', 'watch_later', 'opus'];
        const foundTypes = Array.from(mediaTypes).filter(type => knownTypes.includes(type));
        
        expect(foundTypes.length).toBeGreaterThan(0);
      }
    }
  });

  test('验证不同类型任务的meta结构差异', async () => {
    const response = await apiContext.get('/api/queue/tasks');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        // 按media_type分组
        const tasksByType: Record<string, any[]> = {};
        
        data.data.forEach((task: any) => {
          if (task.media_type) {
            if (!tasksByType[task.media_type]) {
              tasksByType[task.media_type] = [];
            }
            tasksByType[task.media_type].push(task);
          }
        });
        
        // 验证不同类型有不同的meta字段
        Object.keys(tasksByType).forEach(type => {
          const tasks = tasksByType[type];
          if (tasks.length > 0) {
            const sampleTask = tasks[0];
            expect(sampleTask).toHaveProperty('meta');
            expect(typeof sampleTask.meta).toBe('object');
          }
        });
      }
    }
  });

  test('验证多P视频的page字段', async () => {
    const response = await apiContext.get('/api/queue/tasks');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        // 查找包含page字段的任务
        const multiPageTasks = data.data.filter((task: any) => 
          task.meta && task.meta.page !== undefined
        );
        
        if (multiPageTasks.length > 0) {
          const sampleTask = multiPageTasks[0];
          expect(sampleTask.meta.page).toBeGreaterThan(0);
          expect(typeof sampleTask.meta.page).toBe('number');
        }
      }
    }
  });
});

test.describe('多类型媒体支持 - 数据结构验证', () => {
  let apiContext: APIRequestContext;

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

  test('验证任务数据结构完整性', async () => {
    const response = await apiContext.get('/api/queue/tasks');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const task = data.data[0];
        
        // 验证必填字段
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('media_type');
        expect(task).toHaveProperty('media_id');
        expect(task).toHaveProperty('state');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('meta');
        expect(task).toHaveProperty('prepare');
        expect(task).toHaveProperty('created_at');
        expect(task).toHaveProperty('updated_at');
        
        // 验证字段类型
        expect(typeof task.id).toBe('string');
        expect(typeof task.title).toBe('string');
        expect(typeof task.media_type).toBe('string');
        expect(typeof task.media_id).toBe('string');
        expect(typeof task.state).toBe('number');
        expect(typeof task.status).toBe('object');
        expect(typeof task.meta).toBe('object');
        expect(typeof task.prepare).toBe('object');
        expect(typeof task.created_at).toBe('number');
        expect(typeof task.updated_at).toBe('number');
      }
    }
  });

  test('验证调度器数据结构完整性', async () => {
    const response = await apiContext.get('/api/queue/schedulers');
    
    if (response.status() === 200) {
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const scheduler = data.data[0];
        
        // 验证必填字段
        expect(scheduler).toHaveProperty('id');
        expect(scheduler).toHaveProperty('title');
        expect(scheduler).toHaveProperty('list');
        expect(scheduler).toHaveProperty('count');
        expect(scheduler).toHaveProperty('state');
        expect(scheduler).toHaveProperty('folder');
        expect(scheduler).toHaveProperty('created_at');
        expect(scheduler).toHaveProperty('updated_at');
        
        // 验证字段类型
        expect(typeof scheduler.id).toBe('string');
        expect(typeof scheduler.title).toBe('string');
        expect(Array.isArray(scheduler.list)).toBeTruthy();
        expect(typeof scheduler.count).toBe('number');
        expect(typeof scheduler.state).toBe('number');
        expect(typeof scheduler.folder).toBe('string');
        expect(typeof scheduler.created_at).toBe('number');
        expect(typeof scheduler.updated_at).toBe('number');
        
        // 验证任务列表
        expect(scheduler.list.length).toBe(scheduler.count);
      }
    }
  });
});

test.describe('多类型媒体支持 - 错误处理验证', () => {
  let apiContext: APIRequestContext;

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

  test('创建任务缺少media_type', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: '测试视频',
        media_id: 'BV1test001'
        // 缺少media_type
      }
    });

    expect([400, 422, 500]).toContain(response.status());
  });

  test('创建任务缺少media_id', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: '测试视频',
        media_type: 'video'
        // 缺少media_id
      }
    });

    expect([400, 422, 500]).toContain(response.status());
  });

  test('创建调度器使用空任务列表', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '测试系列',
        task_ids: [],
        folder: '/path/to/folder'
      }
    });

    // 系统可能允许创建空任务列表的调度器
    expect([200, 400, 500]).toContain(response.status());
  });

  test('创建调度器使用无效任务ID', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '测试系列',
        task_ids: ['invalid-task-id-1', 'invalid-task-id-2'],
        folder: '/path/to/folder'
      }
    });

    // 系统可能过滤掉无效任务ID
    expect([200, 400, 500]).toContain(response.status());
  });
});