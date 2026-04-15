/**
 * 间距工具样式
 * Spacing Utility Styles
 */

import { css } from 'styled-components';

// 间距系统
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

// 边距工具
export const margin = {
  none: css`margin: 0;`,
  sm: css`margin: 8px;`,
  md: css`margin: 16px;`,
  lg: css`margin: 24px;`,
};

// 内边距工具
export const padding = {
  none: css`padding: 0;`,
  sm: css`padding: 8px;`,
  md: css`padding: 16px;`,
  lg: css`padding: 24px;`,
};