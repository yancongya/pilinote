/**
 * 排版工具样式
 * Typography Utility Styles
 */

import { css } from 'styled-components';

// 字体大小（移动优先）
export const fontSize = {
  xs: css`font-size: 12px;`,
  sm: css`font-size: 14px;`,
  md: css`font-size: 16px;`, /* 移动端默认 */
  lg: css`font-size: 18px;`,
  xl: css`font-size: 20px;`,
  xxl: css`font-size: 24px;`,
};

// 字体粗细
export const fontWeight = {
  normal: css`font-weight: 400;`,
  medium: css`font-weight: 500;`,
  semibold: css`font-weight: 600;`,
  bold: css`font-weight: 700;`,
};

// 文本对齐
export const textAlign = {
  left: css`text-align: left;`,
  center: css`text-align: center;`,
  right: css`text-align: right;`,
};