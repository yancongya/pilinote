/**
 * 触控优化样式
 * Touch Optimization Styles
 */

import styled, { css } from 'styled-components';

// 触控目标最小尺寸
export const TouchTarget = css`
  min-height: 44px;
  min-width: 44px;
`;

// 触控反馈动画
export const TouchFeedback = css`
  transition: transform 0.1s ease;
  
  &:active {
    transform: scale(0.96);
  }
`;

// 移动端手势提示
export const SwipeHint = styled.div`
  height: 4px;
  width: 40px;
  background-color: #e0e0e0;
  border-radius: 2px;
  margin: 0 auto;
  opacity: 0.5;
`;