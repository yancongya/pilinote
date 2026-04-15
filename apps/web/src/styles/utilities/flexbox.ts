/**
 * Flexbox 工具样式
 * Flexbox Utility Styles
 */

import { css } from 'styled-components';

// Flex容器
export const flex = {
  row: css`
    display: flex;
    flex-direction: row;
  `,
  column: css`
    display: flex;
    flex-direction: column;
  `,
  center: css`
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  between: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  wrap: css`
    display: flex;
    flex-wrap: wrap;
  `,
};

// Flex子项
export const flexItem = {
  grow: css`
    flex-grow: 1;
  `,
  shrink: css`
    flex-shrink: 0;
  `,
  auto: css`
    flex: 1 1 auto;
  `,
};