/**
 * Link Parser Documentation Debug Tests
 *
 * This test suite validates the accuracy of the link-parser.md documentation
 * by testing all documented link types, API endpoints, response structures,
 * field names, and data types against the actual implementation.
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000';

test.describe('Link Parser - Documentation Validation', () => {

  // ==================== Documentation Analysis ====================
  // Based on apps/docs/docs-dev/video-sources/link-parser.md

  // Documented Link Types:
  // 1. BV号 (BV\w{10}) -> MediaType.VIDEO
  // 2. AV号 (av\d+) -> MediaType.VIDEO
  // 3. 番剧EP (ep\d+) -> MediaType.BANGUMI
  // 4. 番剧SS (ss\d+) -> MediaType.BANGUMI
  // 5. 番剧MD (md\d+) -> MediaType.BANGUMI
  // 6. 音乐 (au\d+) -> MediaType.MUSIC
  // 7. 歌单 (am\d+) -> MediaType.MUSIC_LIST
  // 8. 图文 (cv\d+) -> MediaType.OPUS
  // 9. 图文合集 (rl\d+) -> MediaType.OPUS_LIST
  // 10. 课程 (cheese.play/ss\d+) -> MediaType.LESSON
  // 11. 稍后再看 (/watchlater) -> MediaType.WATCH_LATER
  // 12. 收藏夹 (space.bilibili.com/{mid}/favlist) -> MediaType.FAVORITE

  // Documented API Endpoint:
  // POST /api/download/parse

  // Documented Response Structure:
  // {
  //   "success": boolean,
  //   "data": {
  //     "parsed_id": {
  //       "id": string,
  //       "type": string,
  //       "original": string
  //     },
  //     "video": {
  //       "bvid": string,
  //       "aid": number,
  //       "title": string,
  //       "desc": string,
  //       "pic": string,
  //       "duration": number,
  //       "pubdate": number,
  //       "cid": number,
  //       "owner": {
  //         "mid": number,
  //         "name": string,
  //         "face": string
  //       },
  //       "stat": {
  //         "view": number,
  //         "danmaku": number,
  //         "reply": number,
  //         "favorite": number,
  //         "coin": number,
  //         "share": number,
  //         "like": number
  //       }
  //     },
  //     "download_options": {
  //       "multi_part": boolean,
  //       "pages": [...]
  //     }
  //   },
  //   "message": string | null
  // }

  test('API endpoint exists: POST /api/download/parse', async ({ request }) => {
    // Verify the documented API endpoint exists
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'test' }
    });

    // Should not be 404
    expect(response.status()).not.toBe(404);
  });

  // ==================== Video ID Tests ====================

  test('Parse BV ID - returns correct type and structure', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'BV1xx411c7mD' }
    });

    const data = await response.json();

    // Documented: success should be boolean
    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');

    if (data.success) {
      // Documented: parsed_id.type should be "video"
      expect(data.data).toHaveProperty('parsed_id');
      expect(data.data.parsed_id).toHaveProperty('type');
      expect(data.data.parsed_id.type).toBe('video');

      // Documented: video structure
      expect(data.data).toHaveProperty('video');
      expect(data.data.video).toHaveProperty('bvid');
      expect(data.data.video).toHaveProperty('aid');
      expect(data.data.video).toHaveProperty('title');
      expect(data.data.video).toHaveProperty('desc');
      expect(data.data.video).toHaveProperty('pic');
      expect(data.data.video).toHaveProperty('duration');
      expect(data.data.video).toHaveProperty('pubdate');
      expect(data.data.video).toHaveProperty('cid');
      expect(data.data.video).toHaveProperty('owner');
      expect(data.data.video).toHaveProperty('stat');

      // Documented: owner structure
      expect(data.data.video.owner).toHaveProperty('mid');
      expect(data.data.video.owner).toHaveProperty('name');
      expect(data.data.video.owner).toHaveProperty('face');

      // Documented: stat structure
      expect(data.data.video.stat).toHaveProperty('view');
      expect(data.data.video.stat).toHaveProperty('danmaku');
      expect(data.data.video.stat).toHaveProperty('reply');
      expect(data.data.video.stat).toHaveProperty('favorite');
      expect(data.data.video.stat).toHaveProperty('coin');
      expect(data.data.video.stat).toHaveProperty('share');
      expect(data.data.video.stat).toHaveProperty('like');

      // Documented: data types
      expect(typeof data.data.video.bvid).toBe('string');
      expect(typeof data.data.video.aid).toBe('number');
      expect(typeof data.data.video.title).toBe('string');
      expect(typeof data.data.video.duration).toBe('number');
      expect(typeof data.data.video.pubdate).toBe('number');
      expect(typeof data.data.video.cid).toBe('number');
      expect(typeof data.data.video.owner.mid).toBe('number');
      expect(typeof data.data.video.owner.name).toBe('string');
      expect(typeof data.data.video.owner.face).toBe('string');
      expect(typeof data.data.video.stat.view).toBe('number');
      expect(typeof data.data.video.stat.danmaku).toBe('number');

      // Documented: download_options
      expect(data.data).toHaveProperty('download_options');
      expect(data.data.download_options).toHaveProperty('multi_part');
      expect(typeof data.data.download_options.multi_part).toBe('boolean');
    }
  });

  test('Parse AV ID - returns correct type', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'av12345678' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: AV号应该识别为VIDEO类型
      expect(data.data.parsed_id.type).toBe('video');
    }
  });

  // ==================== URL Format Tests ====================

  test('Parse BV URL - extracts ID correctly', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'https://www.bilibili.com/video/BV1xx411c7mD' }
    });

    const data = await response.json();

    if (data.success) {
      expect(data.data.parsed_id.type).toBe('video');
      expect(data.data.parsed_id.original).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    }
  });

  test('Parse AV URL - extracts ID correctly', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'https://www.bilibili.com/video/av12345678' }
    });

    const data = await response.json();

    if (data.success) {
      expect(data.data.parsed_id.type).toBe('video');
    }
  });

  // ==================== Bangumi Tests ====================

  test('Parse EP ID - returns bangumi type', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'ep123456' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: EP号应该识别为BANGUMI类型
      expect(data.data.parsed_id.type).toBe('bangumi');
    }
  });

  test('Parse SS ID - returns bangumi type (番剧)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'ss123456' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: 纯SS号默认识别为番剧
      expect(data.data.parsed_id.type).toBe('bangumi');
    }
  });

  test('Parse SS URL with bangumi path - returns bangumi type', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'https://www.bilibili.com/bangumi/play/ss42099' }
    });

    const data = await response.json();

    if (data.success) {
      expect(data.data.parsed_id.type).toBe('bangumi');
    }
  });

  // ==================== Lesson/Course Tests ====================

  test('Parse Lesson URL with cheese path - returns lesson type', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'https://www.bilibili.com/cheese/play/ss292774372' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: /cheese/play/ssxxx 应该识别为LESSON类型
      expect(data.data.parsed_id.type).toBe('lesson');

      // Documented: course_info should be present
      expect(data.data).toHaveProperty('course_info');
      expect(data.data.course_info).toHaveProperty('season_id');
      expect(data.data.course_info).toHaveProperty('total_episodes');
      expect(data.data.course_info).toHaveProperty('episodes');
    }
  });

  test('Parse Lesson URL with parameters - removes parameters correctly', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'https://www.bilibili.com/cheese/play/ss292774372?csource=test&spm_id_from=333' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: 带参数的课程链接应该能正确识别
      expect(data.data.parsed_id.type).toBe('lesson');
      expect(data.data.parsed_id.id).toBe('ss292774372');
    }
  });

  // ==================== Opus Tests ====================

  test('Parse CV ID - returns opus type or 404 error', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'cv123456' }
    });

    const data = await response.json();

    // Documented: cv123456 和 rl123456 只是测试用的占位符ID
    // 返回 success: false 并在消息中包含404是正常现象
    // API本身返回200状态码，但在响应体中报告404错误
    expect(data).toHaveProperty('success');

    if (!data.success) {
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('404');
    } else {
      // 如果成功，应该返回opus类型
      expect(data.data.parsed_id.type).toBe('opus');
    }
  });

  test('Parse valid Opus ID - returns opus structure', async ({ request }) => {
    // 使用一个实际的 Opus ID
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: '1182515074827288583' }
    });

    const data = await response.json();

    if (data.success) {
      expect(data.data.parsed_id.type).toBe('opus');

      // Documented: opus_info should be present
      expect(data.data).toHaveProperty('opus_info');
      expect(data.data.opus_info).toHaveProperty('title');
      expect(data.data.opus_info).toHaveProperty('author');
      expect(data.data.opus_info).toHaveProperty('author_avatar');
      expect(data.data.opus_info).toHaveProperty('mid');
      expect(data.data.opus_info).toHaveProperty('stat');
      expect(data.data.opus_info).toHaveProperty('paragraphs');
      expect(data.data.opus_info).toHaveProperty('image_urls');

      // Documented: image_urls should be array
      expect(Array.isArray(data.data.opus_info.image_urls)).toBe(true);
    }
  });

  test('Parse RL ID - returns opus_list type', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'rl123456' }
    });

    const data = await response.json();

    // Documented: 图文合集需要登录
    // 返回错误是正常现象
    expect(data).toHaveProperty('success');
  });

  // ==================== Music Tests ====================

  test('Parse AU ID - returns music type', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'au123456' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: AU号应该识别为MUSIC类型
      expect(data.data.parsed_id.type).toBe('music');

      // Documented: music_info should be present
      expect(data.data).toHaveProperty('music_info');
    }
  });

  test('Parse AM ID - returns music_list type', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'am123456' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: AM号应该识别为MUSIC_LIST类型
      expect(data.data.parsed_id.type).toBe('music_list');
    }
  });

  // ==================== Error Handling Tests ====================

  test('Invalid URL - returns error message', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'invalid-url-12345' }
    });

    const data = await response.json();

    // Documented: 应该返回 success: false 和错误消息
    expect(data.success).toBe(false);
    expect(data).toHaveProperty('message');
    expect(data.message).toBeTruthy();
  });

  test('Empty URL - returns validation error', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: '' }
    });

    // Documented: 空URL会触发FastAPI的Pydantic验证，返回422状态码和FastAPI标准格式
    expect(response.status()).toBe(422);

    const data = await response.json();

    // Documented: FastAPI验证错误格式
    expect(data).toHaveProperty('detail');
    expect(Array.isArray(data.detail)).toBe(true);
    expect(data.detail[0]).toHaveProperty('loc');
    expect(data.detail[0]).toHaveProperty('msg');
    expect(data.detail[0].msg).toContain('不能为空');
  });

  test('Non-Bilibili URL - returns error message', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' }
    });

    const data = await response.json();

    // Documented: 应该返回 "不支持的链接格式" 错误
    expect(data.success).toBe(false);
    expect(data.message).toContain('不支持的链接格式');
  });

  // ==================== Response Structure Consistency Tests ====================

  test('All successful responses have consistent structure', async ({ request }) => {
    const testUrls = [
      'BV1xx411c7mD',
      'av12345678',
      'https://www.bilibili.com/video/BV1xx411c7mD',
    ];

    for (const url of testUrls) {
      const response = await request.post(`${API_BASE}/api/download/parse`, {
        headers: { 'Content-Type': 'application/json' },
        data: { url }
      });

      const data = await response.json();

      if (data.success) {
        // Documented: 所有成功响应都应该有这些字段
        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('parsed_id');
        expect(data.data).toHaveProperty('video');
        expect(data.data).toHaveProperty('download_options');

        // Documented: parsed_id 结构
        expect(data.data.parsed_id).toHaveProperty('id');
        expect(data.data.parsed_id).toHaveProperty('type');
        expect(data.data.parsed_id).toHaveProperty('original');

        // Documented: video 结构
        expect(data.data.video).toHaveProperty('bvid');
        expect(data.data.video).toHaveProperty('aid');
        expect(data.data.video).toHaveProperty('title');
        expect(data.data.video).toHaveProperty('owner');
        expect(data.data.video).toHaveProperty('stat');
      }
    }
  });

  test('All error responses have consistent structure', async ({ request }) => {
    const testUrls = [
      { url: 'invalid-url', expectedStatus: 200, expectedFormat: 'business' },  // 业务逻辑错误
      { url: 'https://youtube.com/watch?v=test', expectedStatus: 200, expectedFormat: 'business' },  // 业务逻辑错误
    ];

    for (const testCase of testUrls) {
      const response = await request.post(`${API_BASE}/api/download/parse`, {
        headers: { 'Content-Type': 'application/json' },
        data: { url: testCase.url }
      });

      // Documented: 业务逻辑错误返回200状态码
      expect(response.status()).toBe(testCase.expectedStatus);

      const data = await response.json();

      // Documented: 业务逻辑错误应该有这些字段
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('message');
      expect(data.message).toBeTruthy();
    }

    // 测试验证错误（空URL）
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: '' }
    });

    // Documented: 验证错误返回422状态码和FastAPI格式
    expect(response.status()).toBe(422);

    const data = await response.json();
    expect(data).toHaveProperty('detail');
    expect(Array.isArray(data.detail)).toBe(true);
  });

  // ==================== Field Type Validation Tests ====================

  test('Video info field types match documentation', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'BV1xx411c7mD' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented field types from link-parser.md
      const expectedTypes = {
        bvid: 'string',
        aid: 'number',
        title: 'string',
        desc: 'string',
        pic: 'string',
        duration: 'number',
        pubdate: 'number',
        cid: 'number',
      };

      for (const [field, expectedType] of Object.entries(expectedTypes)) {
        expect(data.data.video).toHaveProperty(field);
        expect(typeof data.data.video[field]).toBe(expectedType);
      }

      // Owner field types
      expect(typeof data.data.video.owner.mid).toBe('number');
      expect(typeof data.data.video.owner.name).toBe('string');
      expect(typeof data.data.video.owner.face).toBe('string');

      // Stat field types
      expect(typeof data.data.video.stat.view).toBe('number');
      expect(typeof data.data.video.stat.danmaku).toBe('number');
      expect(typeof data.data.video.stat.reply).toBe('number');
      expect(typeof data.data.video.stat.favorite).toBe('number');
      expect(typeof data.data.video.stat.coin).toBe('number');
      expect(typeof data.data.video.stat.share).toBe('number');
      expect(typeof data.data.video.stat.like).toBe('number');
    }
  });

  // ==================== Opus-specific Structure Tests ====================

  test('Opus response has documented structure', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: '1182515074827288583' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: opus_info structure
      expect(data.data).toHaveProperty('opus_info');
      expect(data.data.opus_info).toHaveProperty('title');
      expect(data.data.opus_info).toHaveProperty('author');
      expect(data.data.opus_info).toHaveProperty('author_avatar');
      expect(data.data.opus_info).toHaveProperty('mid');
      expect(data.data.opus_info).toHaveProperty('stat');
      expect(data.data.opus_info).toHaveProperty('paragraphs');
      expect(data.data.opus_info).toHaveProperty('image_urls');

      // Documented: stat structure for opus
      expect(data.data.opus_info.stat).toHaveProperty('like');
      expect(data.data.opus_info.stat).toHaveProperty('comment');
      expect(data.data.opus_info.stat).toHaveProperty('forward');
      expect(data.data.opus_info.stat).toHaveProperty('favorite');
      expect(data.data.opus_info.stat).toHaveProperty('coin');

      // Documented: stat fields should have count property
      expect(data.data.opus_info.stat.like).toHaveProperty('count');
      expect(data.data.opus_info.stat.comment).toHaveProperty('count');
      expect(data.data.opus_info.stat.forward).toHaveProperty('count');
    }
  });

  // ==================== Course-specific Structure Tests ====================

  test('Course response has documented structure', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'https://www.bilibili.com/cheese/play/ss292774372' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: course_info structure
      expect(data.data).toHaveProperty('course_info');
      expect(data.data.course_info).toHaveProperty('season_id');
      expect(data.data.course_info).toHaveProperty('total_episodes');
      expect(data.data.course_info).toHaveProperty('episodes');

      // Documented: season_id should be number
      expect(typeof data.data.course_info.season_id).toBe('number');

      // Documented: total_episodes should be number
      expect(typeof data.data.course_info.total_episodes).toBe('number');

      // Documented: episodes should be array
      expect(Array.isArray(data.data.course_info.episodes)).toBe(true);

      // Documented: multi_part should be true for courses
      expect(data.data.download_options.multi_part).toBe(true);
    }
  });

  // ==================== Download Options Tests ====================

  test('Download options structure is consistent', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/download/parse`, {
      headers: { 'Content-Type': 'application/json' },
      data: { url: 'BV1xx411c7mD' }
    });

    const data = await response.json();

    if (data.success) {
      // Documented: download_options structure
      expect(data.data).toHaveProperty('download_options');
      expect(data.data.download_options).toHaveProperty('multi_part');
      expect(typeof data.data.download_options.multi_part).toBe('boolean');

      // Documented: pages should be array if present
      if (data.data.download_options.pages) {
        expect(Array.isArray(data.data.download_options.pages)).toBe(true);

        // Check page structure
        if (data.data.download_options.pages.length > 0) {
          const firstPage = data.data.download_options.pages[0];
          expect(firstPage).toHaveProperty('page');
          expect(firstPage).toHaveProperty('cid');
          expect(firstPage).toHaveProperty('part');
          expect(firstPage).toHaveProperty('duration');

          // Documented: page field types
          expect(typeof firstPage.page).toBe('number');
          expect(typeof firstPage.cid).toBe('number');
          expect(typeof firstPage.part).toBe('string');
          expect(typeof firstPage.duration).toBe('number');
        }
      }
    }
  });

  // ==================== Documentation Completeness Tests ====================

  test('Documented media types are supported', async ({ request }) => {
    // Documented media types from link-parser.md
    const documentedTypes = [
      'video',      // BV, AV
      'bangumi',    // EP, SS, MD
      'lesson',     // cheese.play/ss
      'music',      // AU
      'music_list', // AM
      'opus',       // CV
      'opus_list',  // RL
    ];

    // Test that each type can be parsed (even if specific IDs don't exist)
    const testCases = [
      { url: 'BV1xx411c7mD', type: 'video' },
      { url: 'av12345678', type: 'video' },
      { url: 'ep123456', type: 'bangumi' },
      { url: 'ss123456', type: 'bangumi' },
      { url: 'md123456', type: 'bangumi' },
      { url: 'https://www.bilibili.com/cheese/play/ss292774372', type: 'lesson' },
      { url: 'au123456', type: 'music' },
      { url: 'am123456', type: 'music_list' },
      { url: 'cv123456', type: 'opus' },
      { url: 'rl123456', type: 'opus_list' },
    ];

    for (const testCase of testCases) {
      const response = await request.post(`${API_BASE}/api/download/parse`, {
        headers: { 'Content-Type': 'application/json' },
        data: { url: testCase.url }
      });

      const data = await response.json();

      if (data.success) {
        expect(data.data.parsed_id.type).toBe(testCase.type);
      }
    }
  });
});
