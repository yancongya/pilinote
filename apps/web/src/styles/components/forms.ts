/**
 * 表单组件样式 - 完整版
 * Form Component Styles - Complete
 */

import styled, { css } from 'styled-components';
import { BaseTransition } from '../animations/transitions';
import { TouchFeedback, TouchTarget } from '../mobile/touch';
import { FocusEffect } from '../animations/micro-interactions';

/**
 * 基础输入框样式
 * 移动优先，触控优化
 */
export const BaseInput = styled.input<{ size?: 'small' | 'medium' | 'large' }>`
  /* 基础样式 */
  width: 100%;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: inherit;
  ${BaseTransition}
  ${FocusEffect}
  
  /* 移动优先 - 默认为移动端尺寸 */
  ${TouchTarget}
  min-height: 44px;
  padding: 12px 16px;
  font-size: 16px; /* 防止iOS自动缩放 */
  
  /* 尺寸变体 */
  ${(props) => {
    switch (props.size) {
      case 'small':
        return css`
          min-height: 36px;
          padding: 8px 12px;
          font-size: 14px;
        `;
      case 'large':
        return css`
          min-height: 52px;
          padding: 16px 20px;
          font-size: 18px;
        `;
      default:
        return '';
    }
  }}
  
  /* 桌面端尺寸调整 */
  @media (min-width: 768px) {
    min-height: 40px;
    padding: 10px 14px;
    font-size: 14px;
    
    ${(props) => {
      switch (props.size) {
        case 'small':
          return css`
            min-height: 32px;
            padding: 6px 10px;
            font-size: 13px;
          `;
        case 'large':
          return css`
            min-height: 48px;
            padding: 14px 18px;
            font-size: 16px;
          `;
        default:
          return '';
      }
    }}
  }
  
  /* 焦点状态 */
  &:focus {
    border-color: #6366f1;
    outline: none;
  }
  
  /* 错误状态 */
  &[aria-invalid='true'] {
    border-color: #ef4444;
    
    &:focus {
      border-color: #ef4444;
    }
  }
  
  /* 禁用状态 */
  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  /* 占位符样式 */
  &::placeholder {
    color: #9ca3af;
  }
`;

/**
 * 文本域
 */
export const BaseTextarea = styled.textarea<{ size?: 'small' | 'medium' | 'large' }>`
  /* 基础样式 */
  width: 100%;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: inherit;
  resize: vertical;
  ${BaseTransition}
  ${FocusEffect}
  
  /* 移动优先 - 默认为移动端尺寸 */
  min-height: 120px;
  padding: 12px 16px;
  font-size: 16px;
  line-height: 1.5;
  
  /* 尺寸变体 */
  ${(props) => {
    switch (props.size) {
      case 'small':
        return css`
          min-height: 80px;
          padding: 10px 14px;
          font-size: 14px;
        `;
      case 'large':
        return css`
          min-height: 200px;
          padding: 16px 20px;
          font-size: 18px;
        `;
      default:
        return '';
    }
  }}
  
  /* 桌面端尺寸调整 */
  @media (min-width: 768px) {
    min-height: 100px;
    padding: 12px 16px;
    font-size: 14px;
    
    ${(props) => {
      switch (props.size) {
        case 'small':
          return css`
            min-height: 60px;
            padding: 10px 14px;
            font-size: 13px;
          `;
        case 'large':
          return css`
            min-height: 180px;
            padding: 14px 18px;
            font-size: 16px;
          `;
        default:
          return '';
      }
    }}
  }
  
  /* 焦点状态 */
  &:focus {
    border-color: #6366f1;
    outline: none;
  }
  
  /* 错误状态 */
  &[aria-invalid='true'] {
    border-color: #ef4444;
    
    &:focus {
      border-color: #ef4444;
    }
  }
  
  /* 禁用状态 */
  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  /* 占位符样式 */
  &::placeholder {
    color: #9ca3af;
  }
`;

/**
 * 下拉选择框
 */
export const BaseSelect = styled.select<{ size?: 'small' | 'medium' | 'large' }>`
  /* 基础样式 */
  width: 100%;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: inherit;
  background-color: #ffffff;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  ${BaseTransition}
  ${FocusEffect}
  
  /* 移动优先 - 默认为移动端尺寸 */
  ${TouchTarget}
  min-height: 44px;
  padding: 12px 40px 12px 16px;
  font-size: 16px;
  
  /* 尺寸变体 */
  ${(props) => {
    switch (props.size) {
      case 'small':
        return css`
          min-height: 36px;
          padding: 8px 36px 8px 12px;
          font-size: 14px;
        `;
      case 'large':
        return css`
          min-height: 52px;
          padding: 16px 44px 16px 20px;
          font-size: 18px;
        `;
      default:
        return '';
    }
  }}
  
  /* 桌面端尺寸调整 */
  @media (min-width: 768px) {
    min-height: 40px;
    padding: 10px 36px 10px 14px;
    font-size: 14px;
    
    ${(props) => {
      switch (props.size) {
        case 'small':
          return css`
            min-height: 32px;
            padding: 6px 32px 6px 10px;
            font-size: 13px;
          `;
        case 'large':
          return css`
            min-height: 48px;
            padding: 14px 40px 14px 18px;
            font-size: 16px;
          `;
        default:
          return '';
      }
    }}
  }
  
  /* 焦点状态 */
  &:focus {
    border-color: #6366f1;
    outline: none;
  }
  
  /* 错误状态 */
  &[aria-invalid='true'] {
    border-color: #ef4444;
    
    &:focus {
      border-color: #ef4444;
    }
  }
  
  /* 禁用状态 */
  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

/**
 * 标签容器
 */
export const Label = styled.label<{ size?: 'small' | 'medium' | 'large' }>`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #1f2937;
  
  /* 尺寸变体 */
  ${(props) => {
    switch (props.size) {
      case 'small':
        return css`
          font-size: 13px;
          margin-bottom: 6px;
        `;
      case 'large':
        return css`
          font-size: 16px;
          margin-bottom: 10px;
        `;
      default:
        return css`
          font-size: 14px;
        `;
    }
  }}
`;

/**
 * 错误消息
 */
export const ErrorMessage = styled.span`
  display: block;
  margin-top: 6px;
  color: #ef4444;
  font-size: 13px;
`;

/**
 * 表单组容器
 */
export const FormGroup = styled.div<{ spacing?: 'small' | 'medium' | 'large' }>`
  margin-bottom: 16px;
  
  ${(props) => {
    switch (props.spacing) {
      case 'small':
        return css`
          margin-bottom: 12px;
        `;
      case 'large':
        return css`
          margin-bottom: 24px;
        `;
      default:
        return '';
    }
  }}
`;

/**
 * 复选框容器
 */
export const CheckboxContainer = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
  ${TouchFeedback}
  
  input[type='checkbox'] {
    width: 20px;
    height: 20px;
    margin-right: 10px;
    cursor: pointer;
    accent-color: #6366f1;
  }
  
  span {
    font-size: 14px;
    color: #1f2937;
  }
  
  @media (min-width: 768px) {
    input[type='checkbox'] {
      width: 18px;
      height: 18px;
    }
    
    span {
      font-size: 13px;
    }
  }
`;

/**
 * 单选按钮容器
 */
export const RadioContainer = styled.label`
  display: flex;
  align-items: center;
  cursor: pointer;
  ${TouchFeedback}
  
  input[type='radio'] {
    width: 20px;
    height: 20px;
    margin-right: 10px;
    cursor: pointer;
    accent-color: #6366f1;
  }
  
  span {
    font-size: 14px;
    color: #1f2937;
  }
  
  @media (min-width: 768px) {
    input[type='radio'] {
      width: 18px;
      height: 18px;
    }
    
    span {
      font-size: 13px;
    }
  }
`;