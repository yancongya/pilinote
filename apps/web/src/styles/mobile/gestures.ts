/**
 * 手势交互样式
 * Gesture Interaction Styles
 */

import styled from 'styled-components';

// 滑动手势容器
export const SwipeContainer = styled.div`
  position: relative;
  overflow: hidden;
`;

// 下拉刷新容器
export const PullToRefresh = styled.div`
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: height 0.3s ease;
`;

// 占位导出
export const PanResponder = styled.div``;