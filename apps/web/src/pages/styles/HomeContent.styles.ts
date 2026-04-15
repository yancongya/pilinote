/**
 * HomeContent组件样式
 * HomeContent Component Styles
 * 
 * 使用styled-components重构首页内容组件样式
 * 移动优先设计，支持视频链接解析和历史记录
 */

import styled from 'styled-components';
import { css } from 'styled-components';
import { SmoothTransition } from '../../styles/animations/transitions';
import { TouchTarget } from '../../styles/mobile/touch';
import { BaseInput } from '../../styles/components/forms';
import { BaseButton } from '../../styles/components/buttons';

/**
 * 首页输入区域
 */
export const HomeInputSection = styled.div<{ $hasContent?: boolean }>`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
  
  ${(props) => props.$hasContent && css`
    justify-content: flex-start;
  `}
  
  @media (min-width: 768px) {
    margin-bottom: 24px;
    padding: 24px 0;
  }
  
  @media (max-width: 640px) {
    padding: 12px 0;
  }
`;

/**
 * URL输入容器
 */
export const UrlInputContainer = styled.div`
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: stretch;
  flex-wrap: wrap;
`;

/**
 * URL输入框
 */
export const UrlInput = styled(BaseInput)`
  flex: 1;
  min-width: 200px;
  font-size: 15px;
  padding: 16px 20px;
  min-height: 52px;
  
  &::placeholder {
    color: var(--color-text-tertiary);
    font-weight: 400;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
    padding: 14px 16px;
    min-height: 48px;
  }
`;

/**
 * 解析按钮
 */
export const ParseButton = styled(BaseButton)`
  padding: 0 24px;
  min-height: 52px;
  min-width: 120px;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  
  @media (max-width: 480px) {
    min-height: 48px;
    padding: 0 20px;
    font-size: 14px;
  }
`;

/**
 * 错误消息
 */
export const ErrorMessage = styled.div`
  width: 100%;
  max-width: 800px;
  padding: 14px 20px;
  background: var(--color-error-100);
  color: var(--color-error-600);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: var(--shadow-error);
  display: flex;
  align-items: center;
  gap: 8px;
  animation: slideUp 0.2s ease;
  
  &::before {
    content: '⚠';
    font-size: 16px;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/**
 * 视频信息卡片
 */
export const VideoInfoCard = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  flex-direction: row;
  gap: 0;
  cursor: pointer;
  ${TouchTarget};
  ${SmoothTransition};
  background: var(--color-bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

/**
 * 视频封面区域
 */
export const VideoCover = styled.div`
  position: relative;
  width: 320px;
  flex-shrink: 0;
  height: 180px;
  background-color: var(--color-bg-tertiary);
  
  @media (max-width: 768px) {
    width: 100%;
    height: 200px;
  }
`;

/**
 * 视频封面图片
 */
export const VideoCoverImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

/**
 * 视频时长标签
 */
export const VideoDurationLabel = styled.div<{ $isOpus?: boolean }>`
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: ${(props) => props.$isOpus ? 'var(--color-primary)' : 'rgba(0, 0, 0, 0.75)'};
  color: var(--color-white);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(4px);
`;

/**
 * 视频详情区域
 */
export const VideoDetails = styled.div`
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  background: var(--color-bg-primary);
  
  @media (max-width: 768px) {
    padding: 14px;
  }
`;

/**
 * 视频标题
 */
export const VideoTitle = styled.h3`
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  
  @media (min-width: 768px) {
    font-size: 16px;
  }
`;

/**
 * 视频上传者信息
 */
export const VideoUploaderInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

/**
 * 上传者头像
 */
export const UploaderAvatar = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  object-fit: cover;
`;

/**
 * 上传者名称
 */
export const UploaderName = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
`;

/**
 * 视频统计信息
 */
export const VideoStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  
  span {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  
  svg {
    width: 11px;
    height: 11px;
    flex-shrink: 0;
  }
`;

/**
 * 视频简介
 */
export const VideoDescription = styled.p`
  font-size: 12px;
  color: var(--color-text-tertiary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  background: var(--color-bg-secondary);
  padding: 12px;
  border-radius: 8px;
`;

/**
 * 分P选择区域
 */
export const PartSelectionArea = styled.div`
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 10px;
  max-height: 150px;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    max-height: 200px;
  }
`;

/**
 * 分P选择头部
 */
export const PartSelectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

/**
 * 分P标题
 */
export const PartTitle = styled.h4`
  font-size: 12px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
`;

/**
 * 分P操作按钮组
 */
export const PartActions = styled.div`
  display: flex;
  gap: 6px;
`;

/**
 * 分P操作按钮
 */
export const PartActionButton = styled.button<{ $disabled?: boolean }>`
  font-size: 11px;
  padding: 3px 6px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: ${(props) => props.$disabled ? 'not-allowed' : 'pointer'};
  opacity: ${(props) => props.$disabled ? 0.5 : 1};
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: var(--color-bg-hover);
    border-color: var(--color-primary-600);
  }
  
  &:active:not(:disabled) {
    transform: scale(0.95);
  }
`;

/**
 * 分P列表
 */
export const PartList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

/**
 * 分P项
 */
export const PartItem = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: ${(props) => props.$selected ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)'};
  border-radius: 4px;
  cursor: pointer;
  border: ${(props) => props.$selected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)'};
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--color-bg-hover);
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

/**
 * 分P复选框
 */
export const PartCheckbox = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: ${(props) => props.$selected ? 'var(--color-primary)' : 'var(--color-border)'};
  border-radius: 2px;
  flex-shrink: 0;
`;

/**
 * 分P信息容器
 */
export const PartInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

/**
 * 分P序号
 */
export const PartNumber = styled.div`
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-bottom: 2px;
`;

/**
 * 分P标题
 */
export const PartName = styled.div`
  font-size: 12px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
`;

/**
 * 分P时长
 */
export const PartDuration = styled.div`
  font-size: 10px;
  color: var(--color-text-tertiary);
`;

/**
 * 操作按钮区域
 */
export const ActionButtons = styled.div`
  margin-top: auto;
  padding-top: 8px;
`;

/**
 * 下载按钮
 */
export const DownloadButton = styled(BaseButton)`
  width: 100%;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  @media (max-width: 480px) {
    font-size: 13px;
    padding: 9px 14px;
  }
`;

/**
 * 加载图标动画
 */
export const LoadingSpinner = styled.div`
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;