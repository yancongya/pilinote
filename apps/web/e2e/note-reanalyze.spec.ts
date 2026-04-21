import { test, expect } from '@playwright/test';

test.describe('NoteTab 重新分析功能', () => {
  test('点击重新分析按钮应该显示进度面板', async ({ page }) => {
    // 监听控制台日志
    page.on('console', msg => {
      console.log('[Browser Console]', msg.type(), msg.text());
    });

    // 监听网络请求
    page.on('response', response => {
      if (response.url().includes('/api/note/')) {
        console.log('[Network]', response.status(), response.url());
      }
    });

    // 直接访问 AI 笔记页面
    await page.goto('/video/BV1XMdYBHEGp/ai');

    // 等待页面加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 截图：初始状态
    await page.screenshot({ path: 'test-results/01-initial-state.png' });

    // 切换到笔记 tab（使用 button 角色避免歧义）
    const noteTab = page.getByRole('button', { name: '笔记' });
    await noteTab.click();
    await page.waitForTimeout(1000);

    // 截图：切换到笔记 tab 后
    await page.screenshot({ path: 'test-results/02-after-note-tab.png' });

    // 查找"重新分析"按钮
    const reanalyzeBtn = page.getByRole('button', { name: '重新分析' });
    const isReanalyzeVisible = await reanalyzeBtn.isVisible().catch(() => false);

    console.log('重新分析按钮可见:', isReanalyzeVisible);

    if (isReanalyzeVisible) {
      console.log('点击重新分析按钮...');
      
      // 点击前获取 isAnalyzing 状态（通过检查进度面板是否存在来判断）
      const progressPanelBefore = page.getByText('AI 分析进度');
      const isProgressBefore = await progressPanelBefore.isVisible().catch(() => false);
      console.log('点击前进度面板可见:', isProgressBefore);

      await reanalyzeBtn.click();

      // 等待状态变化
      await page.waitForTimeout(1000);

      // 截图：点击后状态
      await page.screenshot({ path: 'test-results/03-after-click.png' });

      // 检查进度弹窗是否显示
      const progressModal = page.locator('text=AI 分析进度');
      const isProgressVisible = await progressModal.isVisible().catch(() => false);
      console.log('进度弹窗可见:', isProgressVisible);

      // 检查弹窗遮罩层
      const modalOverlay = page.locator('div[style*="position: fixed"]');
      const isOverlayVisible = await modalOverlay.isVisible().catch(() => false);
      console.log('弹窗遮罩层可见:', isOverlayVisible);

      // 检查 isAnalyzing 状态（通过检查加载状态）
      const isLoading = await page.locator('text=AI 正在分析字幕并生成笔记...').isVisible().catch(() => false);
      console.log('加载中状态可见:', isLoading);

      // 检查是否有错误信息
      const errorBox = page.locator('[style*="color: #ef4444"]');
      const hasError = await errorBox.isVisible().catch(() => false);
      const errorText = hasError ? await errorBox.textContent() : null;
      console.log('错误信息:', errorText);

      // 检查"重新分析"按钮是否还存在（应该消失，因为 isAnalyzing=true）
      const isReanalyzeStillVisible = await reanalyzeBtn.isVisible().catch(() => false);
      console.log('点击后重新分析按钮仍可见:', isReanalyzeStillVisible);

      // 检查"编辑"按钮是否还存在
      const editBtn = page.getByRole('button', { name: '编辑' });
      const isEditVisible = await editBtn.isVisible().catch(() => false);
      console.log('编辑按钮可见:', isEditVisible);

      // 再等待 2 秒观察轮询行为
      await page.waitForTimeout(2000);

      // 截图：最终状态
      await page.screenshot({ path: 'test-results/04-final-state.png' });

      // 检查 AI 笔记面板是否仍然可见（检查标题栏中的"AI 笔记"文本）
      const aiPanelHeader = page.locator('text=AI 笔记');
      const isPanelVisible = await aiPanelHeader.isVisible().catch(() => false);
      console.log('AI 笔记面板可见:', isPanelVisible);

      // 断言
      expect(isProgressVisible || isOverlayVisible).toBeTruthy();
      // 进度弹窗或遮罩层至少有一个可见
      expect(isProgressVisible || isOverlayVisible || hasError).toBeTruthy();
    } else {
      console.log('重新分析按钮不可见');
      await page.screenshot({ path: 'test-results/03-no-reanalyze-btn.png' });
    }
  });
});
