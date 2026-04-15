/**
 * 导航组件样式
 * Navigation Component Styles
 */

import styled from 'styled-components';

// 底部导航栏（移动端）
export const BottomNav = styled.nav`
  /* 移动优先 */
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background-color: #ffffff;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1000;
  
  /* 触控优化 */
  min-height: 56px;
  
  /* 桌面端隐藏 */
  @media (min-width: 768px) {
    display: none;
  }
`;

// 占位导出
export const SideNav = styled.nav``;
export const HeaderNav = styled.header``;