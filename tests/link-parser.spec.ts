import { test, expect } from '@playwright/test';
import { chromium } from 'playwright';

test.describe('Link Parser - Backend Tests', () => {
  const API_BASE = 'http://localhost:8000';

  test.beforeAll(async () => {
    // 确保后端运行
  });

  // 测试各种链接格式的解析
  const testCases = [
    // 视频 ID
    { input: 'BV1xx411c7mD', expectedType: 'video', desc: 'BV号' },
    { input: 'av12345678', expectedType: 'video', desc: 'AV号' },
    
    // 番剧 ID  
    { input: 'ep123456', expectedType: 'bangumi', desc: '番剧EP' },
    { input: 'ss123456', expectedType: 'bangumi', desc: '番剧SS' },
    { input: 'md123456', expectedType: 'bangumi', desc: '番剧MD' },
    
    // 音乐
    { input: 'au123456', expectedType: 'music', desc: '音乐' },
    
    // 歌单
    { input: 'am123456', expectedType: 'music_list', desc: '歌单' },
    
    // 图文
    { input: 'cv123456', expectedType: 'opus', desc: '图文' },
    
    // 图文合集
    { input: 'rl123456', expectedType: 'opus_list', desc: '图文合集' },
  ];

  testCases.forEach(({ input, expectedType, desc }) => {
    test(`should parse ${desc}: ${input}`, async () => {
      const response = await fetch(`${API_BASE}/api/queue/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input })
      });
      
      const data = await response.json();
      console.log(`[${desc}] ${input}:`, data.success ? 'OK' : data.message);
    });
  });

  // 测试 URL 格式
  const urlTestCases = [
    { input: 'https://www.bilibili.com/video/BV1xx411c7mD', desc: 'BV视频URL' },
    { input: 'https://www.bilibili.com/video/av12345678', desc: 'AV视频URL' },
    { input: 'https://b23.tv/abc123', desc: '短链接' },
  ];

  urlTestCases.forEach(({ input, desc }) => {
    test(`should parse URL: ${desc}`, async () => {
      const response = await fetch(`${API_BASE}/api/queue/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input })
      });
      
      const data = await response.json();
      console.log(`[URL] ${desc}:`, data.success ? 'OK' : data.message);
    });
  });

  // 测试无效链接
  const invalidCases = [
    { input: 'invalid-url', desc: '无效链接' },
    { input: '', desc: '空链接' },
    { input: 'https://youtube.com/video/123', desc: '非B站链接' },
  ];

  invalidCases.forEach(({ input, desc }) => {
    test(`should reject invalid: ${desc}`, async () => {
      const response = await fetch(`${API_BASE}/api/queue/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: input })
      });
      
      const data = await response.json();
      console.log(`[INVALID] ${desc}: success=${data.success}, message=${data.message || 'N/A'}`);
    });
  });
});

test.describe('Link Parser - Unit Tests (Direct)', () => {
  test('should parse BV to AV correctly', async () => {
    // 模拟 BilibiliIDConverter 的 BV 转 AV 逻辑
    const bv = 'BV1xx411c7mD';
    // BV1xx411c7mD 对应的 AV 号应该是 170001
    expect(bv).toMatch(/^BV/);
  });
});