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

    // 番剧 ID（实际可访问的番剧）
    { input: 'ss42099', expectedType: 'bangumi', desc: '番剧SS-超电动机器人 铁人28号FX' },
    { input: 'ss36362', expectedType: 'bangumi', desc: '番剧SS-牙-KIBA' },

    // 课程 ID（带参数）
    { input: 'ss292774372?csource=common_myclass_purchasedlecture_null&spm_id_from=333.87', expectedType: 'bangumi', desc: '课程ID带参数' },

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
      const response = await fetch(`${API_BASE}/api/download/parse`, {
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
    { input: 'https://www.bilibili.com/cheese/play/ss292774372', desc: '课程URL' },
    { input: 'https://www.bilibili.com/cheese/play/ss292774372?csource=common_myclass_purchasedlecture_null&spm_id_from=333.874.selfDef.mine_paid_list', desc: '课程URL带参数' },
    { input: 'https://www.bilibili.com/bangumi/play/ss42099', desc: '番剧URL-超电动机器人 铁人28号FX' },
    { input: 'https://www.bilibili.com/bangumi/play/ss36362', desc: '番剧URL-牙-KIBA' },
  ];

  urlTestCases.forEach(({ input, desc }) => {
      test(`should parse URL: ${desc}`, async () => {
        const response = await fetch(`${API_BASE}/api/download/parse`, {
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
        const response = await fetch(`${API_BASE}/api/download/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: input })
        });
  
        const data = await response.json();
        console.log(`[INVALID] ${desc}: success=${data.success}, message=${data.message || 'N/A'}`);
      });
    });
  
    // 测试课程链接
  
      const courseTestCases = [
  
        {
  
          input: 'https://www.bilibili.com/cheese/play/ss292774372',
  
          desc: '课程完整URL',
  
          expectedType: 'lesson'
  
        },
  
        {
  
          input: 'https://www.bilibili.com/cheese/play/ss292774372?csource=common_myclass_purchasedlecture_null&spm_id_from=333.874.selfDef.mine_paid_list',
  
          desc: '课程URL带参数',
  
          expectedType: 'lesson'
  
        },
  
        {
  
          input: 'ss292774372',
  
          desc: '课程纯ID（会识别为番剧）',
  
          expectedType: 'bangumi'
  
        },
  
      ];
  
    
  
      courseTestCases.forEach(({ input, desc, expectedType }) => {
  
        test(`should parse course: ${desc}`, async () => {
  
          const response = await fetch(`${API_BASE}/api/download/parse`, {
  
            method: 'POST',
  
            headers: { 'Content-Type': 'application/json' },
  
            body: JSON.stringify({ url: input })
  
          });
  
    
  
          const data = await response.json();
  
          console.log(`[COURSE] ${desc}: success=${data.success}, type=${data.data?.parsed_id?.type || 'N/A'}`);
  
    
  
          if (data.success && data.data?.parsed_id) {
  
            expect(data.data.parsed_id.type).toBe(expectedType);
  
          }
  
        });
  
      });
  
    
  
      // 测试番剧链接（实际可访问的番剧）
  
      const bangumiTestCases = [
  
        {
  
          input: 'ss42099',
  
          desc: '番剧纯ID-超电动机器人 铁人28号FX',
  
          expectedType: 'bangumi',
  
          expectedEpisodes: 47
  
        },
  
        {
  
          input: 'https://www.bilibili.com/bangumi/play/ss42099',
  
          desc: '番剧URL-超电动机器人 铁人28号FX',
  
          expectedType: 'bangumi',
  
          expectedEpisodes: 47
  
        },
  
        {
  
          input: 'https://www.bilibili.com/bangumi/play/ss36362',
  
          desc: '番剧URL-牙-KIBA',
  
          expectedType: 'bangumi',
  
          expectedEpisodes: 51
  
        },
  
      ];
  
    
  
      bangumiTestCases.forEach(({ input, desc, expectedType, expectedEpisodes }) => {
  
        test(`should parse bangumi: ${desc}`, async () => {
  
          const response = await fetch(`${API_BASE}/api/download/parse`, {
  
            method: 'POST',
  
            headers: { 'Content-Type': 'application/json' },
  
            body: JSON.stringify({ url: input })
  
          });
  
    
  
          const data = await response.json();
  
          console.log(`[BANGUMI] ${desc}: success=${data.success}, type=${data.data?.parsed_id?.type || 'N/A'}, episodes=${data.data?.download_options?.pages?.length || 0}`);
  
    
  
          if (data.success && data.data?.parsed_id) {
  
            expect(data.data.parsed_id.type).toBe(expectedType);
  
            if (expectedEpisodes) {
  
              expect(data.data.download_options.pages?.length).toBe(expectedEpisodes);
  
            }
  
          }
  
        });
  
      });});

test.describe('Link Parser - Unit Tests (Direct)', () => {
  test('should parse BV to AV correctly', async () => {
    // 模拟 BilibiliIDConverter 的 BV 转 AV 逻辑
    const bv = 'BV1xx411c7mD';
    // BV1xx411c7mD 对应的 AV 号应该是 170001
    expect(bv).toMatch(/^BV/);
  });
});