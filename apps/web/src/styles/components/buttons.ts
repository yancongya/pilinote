/**
 * 按钮组件样式 - 完整版
 * Button Component Styles - Complete
 */

import styled, { css } from 'styled-components';
import { BaseTransition } from '../animations/transitions';
import { TouchFeedback, TouchTarget } from '../mobile/touch';
import { HoverEffect, FocusEffect } from '../animations/micro-interactions';

/**
 * 基础按钮样式
 * 移动优先，触控优化
 */
export const BaseButton = styled.button<{ size?: 'small' | 'medium' | 'large' }>`
  /* 基础样式 */
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
  border-radius: 8px;
  ${BaseTransition}
  ${TouchFeedback}
  ${FocusEffect}
  
  /* 移动优先 - 默认为移动端尺寸 */
  ${TouchTarget}
  min-height: 44px;
  padding: 12px 20px;
  font-size: 16px;
  
  /* 尺寸变体 */
  ${(props) => {
    switch (props.size) {
      case 'small':
        return css`
          min-height: 36px;
          padding: 8px 16px;
          font-size: 14px;
        `;
      case 'large':
        return css`
          min-height: 52px;
          padding: 16px 24px;
          font-size: 18px;
        `;
      default:
        return '';
    }
  }}
  
  /* 桌面端尺寸调整 */
  @media (min-width: 768px) {
    min-height: 40px;
    padding: 10px 24px;
    font-size: 14px;
    
    ${(props) => {
      switch (props.size) {
        case 'small':
          return css`
            min-height: 32px;
            padding: 6px 16px;
            font-size: 13px;
          `;
        case 'large':
          return css`
            min-height: 48px;
            padding: 14px 28px;
            font-size: 16px;
          `;
        default:
          return '';
      }
    }}
  }
  
  /* 桌面端悬停效果 */
  ${HoverEffect}
  
  /* 禁用状态 */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

/**
 * 主要按钮
 */
export const PrimaryButton = styled(BaseButton)`
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  
  &:active {
    box-shadow: 0 1px 4px rgba(99, 102, 241, 0.3);
  }
`;

/**
 * 次要按钮
 */
export const SecondaryButton = styled(BaseButton)`
  background: #ffffff;
  color: #6366f1;
  border: 2px solid #6366f1;
  
  &:active {
    background: #f5f5f5;
  }
`;

/**
 * 幽灵按钮
 */
export const GhostButton = styled(BaseButton)`
  background: transparent;
  color: #6366f1;
  
  &:active {
    background: rgba(99, 102, 241, 0.1);
  }
`;

/**
 * 图标按钮
 */
export const IconButton = styled.button<{ size?: 'small' | 'medium' | 'large' }>`
  /* 基础样式 */
  border: none;
  cursor: pointer;
  background: transparent;
  border-radius: 50%;
  ${BaseTransition}
  ${TouchFeedback}
  ${FocusEffect}
  
  /* 移动优先 - 默认为移动端尺寸 */
  ${TouchTarget}
  min-width: 44px;
  min-height: 44px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  /* 尺寸变体 */
  ${(props) => {
    switch (props.size) {
      case 'small':
        return css`
          min-width: 36px;
          min-height: 36px;
          width: 36px;
          height: 36px;
        `;
      case 'large':
        return css`
          min-width: 52px;
          min-height: 52px;
          width: 52px;
          height: 52px;
        `;
      default:
        return '';
    }
  }}
  
  /* 桌面端尺寸调整 */
  @media (min-width: 768px) {
    min-width: 40px;
    min-height: 40px;
    width: 40px;
    height: 40px;
    
    ${(props) => {
      switch (props.size) {
        case 'small':
          return css`
            min-width: 32px;
            min-height: 32px;
            width: 32px;
            height: 32px;
          `;
        case 'large':
          return css`
            min-width: 48px;
            min-height: 48px;
            width: 48px;
            height: 48px;
          `;
        default:
          return '';
      }
    }}
  }
  
  /* 桌面端悬停效果 */
  ${HoverEffect}
  
  /* 禁用状态 */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

/**
 * 加载按钮
 */
export const LoadingButton = styled(BaseButton)`
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

/**
 * 全宽按钮（移动端）
 */
export const FullWidthButton = styled(BaseButton)`
  width: 100%;
  
  @media (min-width: 768px) {
    width: auto;
    min-width: 200px;
  }
`;