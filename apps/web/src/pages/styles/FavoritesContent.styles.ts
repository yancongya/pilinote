/**
 * FavoritesContent组件样式
 * FavoritesContent Component Styles
 * 
 * 使用styled-components重构收藏页面组件样式
 * 移动优先设计，支持收藏夹列表和视频显示
 */

import styled from 'styled-components';
import { SmoothTransition } from '../../styles/animations/transitions';
import { TouchTarget } from '../../styles/mobile/touch';
import { BaseButton } from '../../styles/components/buttons';

/**
 * 收藏夹列表容器
 */
export const FavFolderList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
`;

/**
 * 收藏夹项
 */
export const FavFolderItem = styled.article`
  background: var(--color-bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  ${TouchTarget};
  ${SmoothTransition};
  display: flex;
  flex-direction: column;
  
  &:hover {
    border-color: var(--color-primary-600);
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &:focus-visible {
    outline: 3px solid var(--color-primary-600);
    outline-offset: 2px;
  }
`;

/**
 * 收藏夹封面区域
 */
export const FavFolderCover = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: var(--color-bg-tertiary);
`;

/**
 * 收藏夹缩略图
 */
export const FavFolderThumbnail = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

/**
 * 收藏夹信息区域
 */
export const FavFolderInfo = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
`;

/**
 * 收藏夹标题
 */
export const FavFolderTitle = styled.h3`
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
 * 收藏夹元数据
 */
export const FavFolderMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

/**
 * 收藏夹数量
 */
export const FavFolderCount = styled.span`
  font-size: 13px;
  color: var(--color-text-tertiary);
  font-weight: 500;
`;

/**
 * 返回按钮
 */
export const BackButton = styled(BaseButton)`
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  padding: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  
  &:hover {
    background: var(--color-bg-hover);
    border-color: var(--color-primary-600);
    color: var(--color-primary-600);
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