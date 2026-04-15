/**
 * 过渡效果 - 完整版
 * Transition Effects - Complete
 */

import { css } from 'styled-components';

/**
 * 基础过渡
 * 通用过渡效果，适用于大多数交互
 */
export const BaseTransition = css`
  transition: all 0.2s ease;
`;

/**
 * 平滑过渡
 * 更柔和的过渡效果，适用于重要交互
 */
export const SmoothTransition = css`
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

/**
 * 弹性过渡
 * 带有弹性的过渡效果，适用于强调元素
 */
export const BouncyTransition = css`
  transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
`;

/**
 * 快速过渡
 * 快速的过渡效果，适用于即时反馈
 */
export const QuickTransition = css`
  transition: all 0.15s ease;
`;

/**
 * 慢速过渡
 * 缓慢的过渡效果，适用于大型布局变化
 */
export const SlowTransition = css`
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
`;

/**
 * 属性过渡
 * 针对特定属性的过渡效果
 */
export const propertyTransitions = {
  color: css`
    transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
  `,
  transform: css`
    transition: transform 0.2s ease;
  `,
  opacity: css`
    transition: opacity 0.3s ease;
  `,
  layout: css`
    transition: width 0.3s ease, height 0.3s ease, padding 0.3s ease, margin 0.3s ease;
  `,
  shadow: css`
    transition: box-shadow 0.3s ease;
  `,
};

/**
 * 交互过渡组合
 * 常用的交互效果组合
 */
export const interactionTransitions = {
  // 按钮交互
  button: css`
    ${BaseTransition}
    
    &:active {
      transition: all 0.1s ease;
    }
  `,
  
  // 卡片悬浮
  cardHover: css`
    ${SmoothTransition}
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
    
    &:active {
      transform: translateY(-2px);
    }
  `,
  
  // 输入框焦点
  inputFocus: css`
    ${propertyTransitions.color}
    ${propertyTransitions.shadow}
  `,
  
  // 模态框动画
  modal: css`
    ${SlowTransition}
  `,
  
  // 下拉菜单
  dropdown: css`
    ${SmoothTransition}
    transform-origin: top;
  `,
};