import { test, expect } from '@playwright/test';

test('check route matching', async ({ page }) => {
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  
  // Test opus page
  await page.goto('http://localhost:5173/opus/1119055528585068562');
  await page.waitForTimeout(3000);
  const bodyText = await page.locator('body').textContent();
  console.log('Opus page:', bodyText?.slice(0, 150));
});