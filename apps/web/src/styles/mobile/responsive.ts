/**
 * 移动端响应式样式
 * Mobile Responsive Styles
 */

import styled from 'styled-components';

// 移动端容器
export const MobileContainer = styled.div`
  padding: 16px;
  
  /* 平板及桌面端 */
  @media (min-width: 768px) {
    padding: 24px;
  }
`;

// 移动端全屏容器
export const MobileFullscreen = styled.div`
  min-height: 100vh;
  padding-bottom: 56px; /* 为底部导航栏留出空间 */
  
  /* 桌面端 */
  @media (min-width: 768px) {
    padding-bottom: 0;
  }
`;

// 占位导出
export const MobileOptimized = styled.div``;