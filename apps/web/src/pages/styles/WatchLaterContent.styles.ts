/**
 * WatchLaterContent组件样式
 * WatchLaterContent Component Styles
 * 
 * 使用styled-components重构稍后再看页面组件样式
 * 移动优先设计，支持视频列表显示
 */

import styled from 'styled-components';
import { SmoothTransition } from '../../styles/animations/transitions';
import { TouchTarget } from '../../styles/mobile/touch';
import { BaseButton } from '../../styles/components/buttons';

/**
 * 稍后再看列表容器
 */
export const WatchLaterList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
`;

/**
 * 稍后再看项
 */
export const WatchLaterItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: 12px;
  align-items: center;
  border: 2px solid transparent;
  cursor: pointer;
  ${TouchTarget};
  ${SmoothTransition};
  
  &:hover {
    border-color: var(--color-primary-600);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  
  &:active {
    transform: scale(0.99);
  }
  
  &:focus-visible {
    outline: 3px solid var(--color-primary-600);
    outline-offset: 2px;
  }
`;

/**
 * 稍后再看缩略图
 */
export const WatchLaterThumbnail = styled.div`
  width: 140px;
  aspect-ratio: 16/9;
  background: var(--color-bg-tertiary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

/**
 * 稍后再看详情
 */
export const WatchLaterDetails = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/**
 * 稍后再看标题
 */
export const WatchLaterTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

/**
 * 稍后再看元数据
 */
export const WatchLaterMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: var(--color-text-secondary);
`;

/**
 * 稍后再看时长
 */
export const WatchLaterDuration = styled.span`
  color: var(--color-text-tertiary);
  font-weight: 500;
`;

/**
 * 稍后再看时间
 */
export const WatchLaterTime = styled.span`
  color: var(--color-text-tertiary);
  font-weight: 500;
`;

/**
 * 稍后再看上传者
 */
export const WatchLaterUploader = styled.span`
  color: var(--color-text-secondary);
  font-weight: 500;
`;

/**
 * 移除按钮
 */
export const RemoveButton = styled(BaseButton)`
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  min-height: 36px;
  min-width: 36px;
  background: var(--color-error-100);
  color: var(--color-error-600);
  border: 1px solid var(--color-error-200);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    background: var(--color-error-200);
    border-color: var(--color-error-300);
  }
`;

/**
 * 空状态容器
 */
export const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-tertiary);
`;

/**
 * 空状态图标
 */
export const EmptyStateIcon = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  color: var(--color-text-tertiary);
  opacity: 0.5;
`;

/**
 * 空状态标题
 */
export const EmptyStateTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--color-text-primary);
`;

/**
 * 空状态描述
 */
export const EmptyStateDescription = styled.p`
  font-size: 14px;
  margin: 0;
  color: var(--color-text-tertiary);
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

/**
 * 错误状态
 */
export const ErrorState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: var(--color-error-600);
  font-size: 14px;
`;