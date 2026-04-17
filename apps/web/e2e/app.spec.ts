import { test, expect } from '@playwright/test';

test.describe('PiliNote App', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('Page title:', await page.title());
  });

  test('can navigate to library', async ({ page }) => {
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
    console.log('Library page loaded');
  });
});

test.describe('AI Note API Integration', () => {
  test('note API returns 404 for non-existent note', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/note/by-video/test-video-id');
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.detail).toContain('暂无笔记');
  });

  test('health check', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });
});