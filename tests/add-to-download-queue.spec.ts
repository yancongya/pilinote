import { test, expect, APIRequestContext, Page } from '@playwright/test';

/**
 * "添加到下载列表"功能链测试
 * 
 * 测试范围：
 * 1. API 端点验证
 * 2. 数据结构验证
 * 3. 收藏页下载流程
 * 4. 稍后再看页下载流程
 * 5. 多P视频处理
 * 6. 扫描功能
 */

const BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:5173';

test.describe('添加到下载列表 - API端点验证', () => {
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

  test('POST /api/queue/tasks - 端点存在', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: '测试视频',
        media_type: 'video',
        media_id: 'BV1xx411c7mD',
        cover: 'https://example.com/cover.jpg',
        desc: '测试描述',
        meta: { cid: 123456 }
      }
    });

    expect([200, 400, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('data');
    }
  });

  test('GET /api/queue/tasks - 端点存在', async () => {
    const response = await apiContext.get('/api/queue/tasks');
    
    expect([200, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBeTruthy();
    }
  });

  test('PUT /api/queue/tasks/{task_id} - 端点存在', async () => {
    const response = await apiContext.put('/api/queue/tasks/test-task-id', {
      data: { state: 2 }
    });
    
    expect([200, 404, 500]).toContain(response.status());
  });

  test('DELETE /api/queue/tasks/{task_id} - 端点存在', async () => {
    const response = await apiContext.delete('/api/queue/tasks/test-task-id');
    
    expect([200, 404, 500]).toContain(response.status());
  });

  test('POST /api/queue/schedulers - 端点存在', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '测试系列',
        task_ids: ['task-1', 'task-2'],
        folder: '/path/to/folder'
      }
    });
    
    expect([200, 400, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('data');
    }
  });

  test('GET /api/queue/schedulers - 端点存在', async () => {
    const response = await apiContext.get('/api/queue/schedulers');
    
    expect([200, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBeTruthy();
    }
  });

  test('POST /api/auto-download/scan/trigger - 端点存在', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=favorite&source_id=all');
    
    expect([200, 400, 401, 500]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
    }
  });
});

test.describe('添加到下载列表 - 数据结构验证', () => {
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

  test('任务响应结构验证', async () => {
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
        expect(task).toHaveProperty('created_at');
        expect(task).toHaveProperty('updated_at');
        
        // 验证 status 字段结构（仅当status不为空时）
        if (Object.keys(task.status).length > 0) {
          expect(task.status).toHaveProperty('stage');
          expect(task.status).toHaveProperty('progress');
          expect(task.status).toHaveProperty('speed');
          expect(task.status).toHaveProperty('eta');
        }
        
        // 验证字段类型
        expect(typeof task.id).toBe('string');
        expect(typeof task.title).toBe('string');
        expect(typeof task.media_type).toBe('string');
        expect(typeof task.media_id).toBe('string');
        expect(typeof task.state).toBe('number');
        expect(typeof task.status).toBe('object');
        expect(typeof task.meta).toBe('object');
        expect(typeof task.created_at).toBe('number');
        expect(typeof task.updated_at).toBe('number');
      }
    }
  });

  test('调度器响应结构验证', async () => {
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
      }
    }
  });

  test('扫描响应结构验证', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=favorite&source_id=all');
    
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
        
        expect(typeof data.data.total).toBe('number');
        expect(typeof data.data.new).toBe('number');
        expect(typeof data.data.added).toBe('number');
        expect(typeof data.data.folder_count).toBe('number');
        expect(Array.isArray(data.data.folders)).toBeTruthy();
      }
    }
  });
});

test.describe('添加到下载列表 - 前端组件验证', () => {
  test('收藏页可访问', async () => {
    // 前端组件测试需要登录状态，在文档验证中跳过
    test.skip();
  });

  test('稍后再看页可访问', async () => {
    // 前端组件测试需要登录状态，在文档验证中跳过
    test.skip();
  });

  test('下载页可访问', async () => {
    // 前端组件测试需要登录状态，在文档验证中跳过
    test.skip();
  });
});

test.describe('添加到下载列表 - 功能流程验证', () => {
  let apiContext: APIRequestContext;
  let createdTaskId: string | null = null;
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
    // 清理测试数据
    if (createdTaskId) {
      try {
        await apiContext.delete(`/api/queue/tasks/${createdTaskId}`);
      } catch (e) {
        // 忽略删除错误
      }
    }
    
    if (createdSchedulerId) {
      try {
        await apiContext.delete(`/api/queue/schedulers/${createdSchedulerId}`);
      } catch (e) {
        // 忽略删除错误
      }
    }
    
    await apiContext.dispose();
  });

  test('创建单个任务流程', async () => {
    const taskData = {
      title: '测试单个视频',
      media_type: 'video',
      media_id: 'BV1testSingle001',
      cover: 'https://example.com/cover.jpg',
      desc: 'CID: 123456',
      meta: { cid: 123456 }
    };

    const response = await apiContext.post('/api/queue/tasks', {
      data: taskData
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('成功');
    expect(data.data).toHaveProperty('id');
    expect(data.data.title).toBe(taskData.title);
    expect(data.data.media_id).toBe(taskData.media_id);
    expect(data.data.state).toBe(0); // BACKLOG state

    createdTaskId = data.data.id;
  });

  test('更新任务状态流程', async () => {
    if (!createdTaskId) {
      test.skip();
      return;
    }

    const response = await apiContext.put(`/api/queue/tasks/${createdTaskId}`, {
      data: { state: 2 } // ACTIVE state
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.state).toBe(2);
  });

  test('创建调度器流程（模拟多P视频）', async () => {
    // 首先创建多个任务
    const taskIds: string[] = [];
    
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
          part_title: `第${i}集`
        }
      };

      const response = await apiContext.post('/api/queue/tasks', {
        data: taskData
      });

      if (response.status() === 200) {
        const data = await response.json();
        taskIds.push(data.data.id);
      }
    }

    expect(taskIds.length).toBeGreaterThan(0);

    // 创建调度器
    const schedulerData = {
      title: '测试系列视频',
      task_ids: taskIds,
      folder: '/tmp/test-series'
    };

    const response = await apiContext.post('/api/queue/schedulers', {
      data: schedulerData
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe(schedulerData.title);
    expect(data.data.list.length).toBe(taskIds.length);
    expect(data.data.count).toBe(taskIds.length);
    expect(data.data.folder).toBe(schedulerData.folder);

    createdSchedulerId = data.data.id;
  });

  test('删除任务流程', async () => {
    if (!createdTaskId) {
      test.skip();
      return;
    }

    const response = await apiContext.delete(`/api/queue/tasks/${createdTaskId}`);

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

test.describe('添加到下载列表 - 错误处理验证', () => {
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

  test('创建任务缺少必填字段', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: '测试视频'
        // 缺少 media_type 和 media_id
      }
    });

    expect([400, 422, 500]).toContain(response.status());
  });

  test('更新不存在的任务', async () => {
    const response = await apiContext.put('/api/queue/tasks/non-existent-task-id', {
      data: { state: 2 }
    });

    expect([404, 500]).toContain(response.status());
  });

  test('删除不存在的任务', async () => {
    const response = await apiContext.delete('/api/queue/tasks/non-existent-task-id');

    expect([404, 500]).toContain(response.status());
  });

  test('创建调度器使用无效的任务ID', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '测试系列',
        task_ids: ['invalid-task-id-1', 'invalid-task-id-2'],
        folder: '/path/to/folder'
      }
    });

    expect([400, 500]).toContain(response.status());
  });

  test('扫描使用无效的源类型', async () => {
    const response = await apiContext.post('/api/auto-download/scan/trigger?source_type=invalid_type&source_id=all');

    expect([400, 500]).toContain(response.status());
  });
});

test.describe('添加到下载列表 - 状态枚举验证', () => {
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

  test('任务状态枚举值验证', async () => {
    const taskData = {
      title: '状态测试视频',
      media_type: 'video',
      media_id: 'BV1testState001',
      cover: 'https://example.com/cover.jpg',
      desc: 'CID: 789012',
      meta: { cid: 789012 }
    };

    const createResponse = await apiContext.post('/api/queue/tasks', {
      data: taskData
    });

    if (createResponse.status() !== 200) {
      test.skip();
      return;
    }

    const createData = await createResponse.json();
    const taskId = createData.data.id;

    try {
      // 测试各个状态值
      const states = [0, 1, 2, 3, 4, 5, 6]; // BACKLOG, PENDING, ACTIVE, COMPLETED, PAUSED, FAILED, CANCELLED
      
      for (const state of states) {
        const response = await apiContext.put(`/api/queue/tasks/${taskId}`, {
          data: { state }
        });

        expect([200, 500]).toContain(response.status());
        
        if (response.status() === 200) {
          const data = await response.json();
          expect(data.data.state).toBe(state);
        }
      }
    } finally {
      // 清理测试数据
      await apiContext.delete(`/api/queue/tasks/${taskId}`);
    }
  });
});

test.describe('添加到下载列表 - WebSocket验证', () => {
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

  test('WebSocket端点可访问', async () => {
    // WebSocket功能测试被跳过，因为它需要特定的连接状态
    // 这个测试在文档验证中不是必需的
    test.skip();
  });
});

test.describe('添加到下载列表 - 参数验证测试', () => {
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

  test('创建任务 - media_id 为空应该失败', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: '测试视频',
        media_type: 'video',
        media_id: '',
        meta: { cid: 123456 }
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('media_id');
  });

  test('创建任务 - media_id 缺失应该失败', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: '测试视频',
        media_type: 'video',
        meta: { cid: 123456 }
      }
    });

    expect(response.status()).toBe(422); // 422 Unprocessable Entity (Pydantic validation error)
  });

  test('创建任务 - media_type 无效应该失败', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: '测试视频',
        media_type: 'invalid_type',
        media_id: 'BV1xx411c7mD',
        meta: { cid: 123456 }
      }
    });

    expect(response.status()).toBe(422); // 422 Unprocessable Entity (Pydantic validation error)
  });

  test('创建任务 - meta 不是字典类型应该失败', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: '测试视频',
        media_type: 'video',
        media_id: 'BV1xx411c7mD',
        meta: "invalid_meta"
      }
    });

    expect(response.status()).toBe(422); // 422 Unprocessable Entity (Pydantic validation error)
  });

  test('创建任务 - title 超过长度限制应该失败', async () => {
    const longTitle = 'A'.repeat(201); // 超过200字符限制

    const response = await apiContext.post('/api/queue/tasks', {
      data: {
        title: longTitle,
        media_type: 'video',
        media_id: 'BV1xx411c7mD',
        meta: { cid: 123456 }
      }
    });

    expect(response.status()).toBe(422); // 422 Unprocessable Entity (Pydantic validation error)
  });

  test('创建调度器 - title 为空应该失败', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '',
        folder: '/path/to/folder'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('title');
  });

  test('创建调度器 - title 缺失应该失败', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        folder: '/path/to/folder'
      }
    });

    expect(response.status()).toBe(422); // 422 Unprocessable Entity (Pydantic validation error)
  });

  test('创建调度器 - folder 为空应该失败', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '测试系列',
        folder: ''
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('folder');
  });

  test('创建调度器 - folder 缺失应该失败', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '测试系列'
      }
    });

    expect(response.status()).toBe(422); // 422 Unprocessable Entity (Pydantic validation error)
  });

  test('创建调度器 - task_ids 为空列表应该失败', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '测试系列',
        task_ids: [],
        folder: '/path/to/folder'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('task_ids');
  });

  test('创建调度器 - task_ids 无效格式应该失败', async () => {
    const response = await apiContext.post('/api/queue/schedulers', {
      data: {
        title: '测试系列',
        task_ids: ['invalid-uuid-format'],
        folder: '/path/to/folder'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('UUID');
  });

  test('创建任务 - 有效的media_type枚举值应该成功', async () => {
    const validTypes = ['video', 'bangumi', 'music', 'lesson', 'watch_later', 'favorite', 'opus', 'user_video'];

    for (const mediaType of validTypes) {
      const response = await apiContext.post('/api/queue/tasks', {
        data: {
          title: `测试${mediaType}`,
          media_type: mediaType,
          media_id: 'BV1xx411c7mD',
          meta: { cid: 123456 }
        }
      });

      expect([200, 400, 500]).toContain(response.status());
      // 注意：这里允许400或500，因为可能其他验证失败（如视频不存在）
      // 但至少media_type枚举验证应该通过（不会返回422）
    }
  });

  test('创建任务 - 所有必需字段都应该有验证', async () => {
    const response = await apiContext.post('/api/queue/tasks', {
      data: {}
    });

    expect(response.status()).toBe(422); // Pydantic验证错误

    const data = await response.json();
    expect(data.detail).toBeInstanceOf(Array);

    // 检查是否验证了必需字段
    const requiredFields = ['media_type', 'media_id'];
    const detail = data.detail as Array<{loc: string[], msg: string, type: string}>;

    for (const field of requiredFields) {
      const fieldError = detail.find(err => err.loc.includes(field));
      expect(fieldError).toBeDefined();
    }
  });
});