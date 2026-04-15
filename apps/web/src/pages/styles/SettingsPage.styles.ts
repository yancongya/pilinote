/**
 * SettingsPage组件样式
 * SettingsPage Component Styles
 * 
 * 使用styled-components重构设置页面组件样式
 * 移动优先设计，支持设置项分组和表单元素
 */

import styled from 'styled-components';
import { TouchTarget } from '../../styles/mobile/touch';
import { BaseInput, BaseSelect, BaseTextarea } from '../../styles/components/forms';
import { BaseButton } from '../../styles/components/buttons';

/**
 * 设置页面容器
 */
export const SettingsPageContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
`;

/**
 * 设置页面标题
 */
export const SettingsPageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 24px;
  color: var(--color-text-primary);
`;

/**
 * 设置分组
 */
export const SettingsGroup = styled.div`
  margin-bottom: 24px;
  border-radius: 16px;
  overflow: hidden;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
`;

/**
 * 设置分组标题
 */
export const SettingsGroupTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  padding: 16px 20px;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
`;

/**
 * 设置项容器
 */
export const SettingsItem = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: flex-start;
  gap: 16px;
  
  &:last-child {
    border-bottom: none;
  }
`;

/**
 * 设置项内容
 */
export const SettingsItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

/**
 * 设置项标题
 */
export const SettingsItemTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--color-text-primary);
`;

/**
 * 设置项描述
 */
export const SettingsItemDescription = styled.p`
  font-size: 13px;
  margin: 0;
  color: var(--color-text-tertiary);
  line-height: 1.5;
`;

/**
 * 设置项控制区域
 */
export const SettingsItemControl = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
`;

/**
 * 开关
 */
export const Toggle = styled.button<{ $checked?: boolean }>`
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 14px;
  border: none;
  background: ${(props) => props.$checked ? 'var(--color-primary-600)' : 'var(--color-border)'};
  cursor: pointer;
  transition: background 0.2s ease;
  ${TouchTarget};
  
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s ease;
    transform: ${(props) => props.$checked ? 'translateX(20px)' : 'translateX(0)'};
  }
  
  &:active::after {
    transform: ${(props) => props.$checked ? 'translateX(18px)' : 'translateX(2px)'};
  }
  
  &:focus-visible {
    outline: 2px solid var(--color-primary-600);
    outline-offset: 2px;
  }
`;

/**
 * 设置输入框
 */
export const SettingsInput = styled(BaseInput)`
  max-width: 400px;
`;

/**
 * 设置选择框
 */
export const SettingsSelect = styled(BaseSelect)`
  max-width: 400px;
`;

/**
 * 设置文本区域
 */
export const SettingsTextarea = styled(BaseTextarea)`
  max-width: 400px;
  min-height: 100px;
`;

/**
 * 设置按钮
 */
export const SettingsButton = styled(BaseButton)`
  min-width: 120px;
`;

/**
 * 危险按钮
 */
export const DangerButton = styled(BaseButton)`
  background: var(--color-error-600);
  
  &:hover {
    background: var(--color-error-700);
  }
`;

/**
 * 按钮组
 */
export const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

/**
 * 保存按钮区域
 */
export const SaveButtonArea = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
`;

/**
 * 信息提示框
 */
export const InfoBox = styled.div<{ $type?: 'info' | 'warning' | 'error' }>`
  padding: 14px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  
  ${(props) => {
    switch (props.$type) {
      case 'warning':
        return `
          background: var(--color-warning-100);
          color: var(--color-warning-700);
          border: 1px solid var(--color-warning-200);
        `;
      case 'error':
        return `
          background: var(--color-error-100);
          color: var(--color-error-700);
          border: 1px solid var(--color-error-200);
        `;
      default:
        return `
          background: var(--color-info-100);
          color: var(--color-info-700);
          border: 1px solid var(--color-info-200);
        `;
    }
  }}
  
  &::before {
    content: '${(props) => {
      switch (props.$type) {
        case 'warning':
          return '⚠';
        case 'error':
          return '✕';
        default:
          return 'ℹ';
      }
    }}';
    margin-right: 8px;
  }
`;

/**
 * 加载状态
 */
export const LoadingState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-tertiary);
  font-size: 14px;
`;