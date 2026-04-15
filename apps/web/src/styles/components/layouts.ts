/**
 * 布局组件样式
 * Layout Component Styles
 */

import styled from 'styled-components';

// 主容器
export const MainContainer = styled.div`
  /* 移动优先 */
  width: 100%;
  padding: 16px;
  
  /* 平板及桌面端 */
  @media (min-width: 768px) {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
`;

// 占位导出
export const GridContainer = styled.div``;
export const FlexContainer = styled.div``;