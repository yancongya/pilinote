/**
 * VideoListCard组件样式
 * VideoListCard Component Styles
 * 
 * 使用styled-components重构视频卡片组件样式
 * 移动优先设计，支持多种显示模式
 */

import styled from 'styled-components';
import { SmoothTransition } from '../../styles/animations/transitions';
import { TouchTarget } from '../../styles/mobile/touch';

/**
 * 视频卡片容器
 * 移动优先设计，支持多种显示模式
 */
export const VideoCard = styled.article<{ $batchMode?: boolean; $selected?: boolean; $clickable?: boolean }>`
  background: var(--color-bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  flex-direction: column;
  ${TouchTarget};
  ${SmoothTransition};

  /* 可点击状态 */
  ${(props) => props.$clickable && `
    cursor: pointer;
  `}

  /* 批量模式样式 */
  ${(props) => props.$batchMode && `
    border-color: ${(props: { $selected?: boolean }) => props.$selected ? 'var(--color-primary-600)' : 'var(--color-border)'};
    background: ${(props: { $selected?: boolean }) => props.$selected ? 'rgba(37, 99, 235, 0.05)' : 'var(--color-bg-secondary)'};
  `}

  /* 悬停效果 - 仅桌面端 */
  @media (min-width: 768px) {
    ${(props) => props.$clickable && !props.$batchMode && `
      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        border-color: var(--color-primary-600);
      }
    `}
  }

  /* 触摸反馈 - 移动端 */
  @media (max-width: 767px) {
    ${(props) => props.$clickable && `
      &:active {
        transform: scale(0.98);
      }
    `}
  }
`;

/**
 * 视频封面区域
 */
export const VideoCardCover = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: var(--color-bg-tertiary);
  flex-shrink: 0;
`;

/**
 * 视频缩略图容器
 */
export const VideoCardThumbnail = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`;

/**
 * 封面图片
 */
export const CoverImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

/**
 * 缩略图占位符
 */
export const ThumbnailPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);

  &.hidden {
    display: none;
  }

  .film-icon {
    width: 48px;
    height: 48px;
    opacity: 0.5;
  }
`;

/**
 * 视频时长覆盖层
 * B站风格：右下角显示时长
 */
export const VideoDurationOverlay = styled.div`
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  white-space: nowrap;
`;

/**
 * 系列集数覆盖层
 * B站风格：左下角显示集数
 */
export const VideoSeriesCountOverlay = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
`;

/**
 * 视频进度覆盖层
 * 用于显示下载进度
 */
export const VideoProgressOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0, 0, 0, 0.2);
`;

/**
 * 视频进度条
 */
export const VideoProgressBar = styled.div<{ $progress?: number }>`
  height: 100%;
  background: var(--color-primary-600);
  width: ${(props) => props.$progress || 0}%;
  transition: width 0.3s ease;
`;

/**
 * 视频信息区域
 */
export const VideoCardInfo = styled.div`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
  
  @media (min-width: 768px) {
    padding: 16px;
  }
`;

/**
 * 视频标题
 */
export const VideoTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  
  @media (min-width: 768px) {
    font-size: 15px;
  }
`;

/**
 * 下载进度信息
 */
export const VideoDownloadProgress = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;

  .progress-text {
    font-size: 12px;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .progress-bar-container {
    width: 100%;
    height: 4px;
    background: var(--color-bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--color-primary-600);
    transition: width 0.3s ease;
  }

  .progress-stats {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--color-text-tertiary);

    .progress-speed {
      color: var(--color-primary-500);
      font-weight: 600;
    }

    .progress-eta {
      color: var(--color-text-tertiary);
    }
  }
`;

/**
 * 视频元数据区域
 */
export const VideoCardMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-tertiary);
`;

/**
 * 上传者信息
 */
export const VideoUploader = styled.span`
  color: var(--color-text-secondary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/**
 * 时间信息
 */
export const VideoTime = styled.span`
  color: var(--color-text-tertiary);
  font-weight: 400;
`;

/**
 * 观看进度信息
 */
export const VideoWatched = styled.span`
  color: var(--color-primary-500);
  font-weight: 600;
`;

/**
 * 文件大小信息
 */
export const VideoFileSize = styled.span`
  color: var(--color-text-tertiary);
  font-weight: 500;
`;

/**
 * 内联操作按钮容器
 */
export const VideoCardActionsInline = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
`;

/**
 * 操作图标按钮
 */
export const ActionIconButton = styled.button<{ $variant?: 'start' | 'pause' | 'delete' }>`
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  ${TouchTarget};

  ${(props) => {
    switch (props.$variant) {
      case 'start':
        return `
          background: var(--color-success-100);
          color: var(--color-success-600);
          &:hover {
            background: var(--color-success-200);
          }
        `;
      case 'pause':
        return `
          background: var(--color-warning-100);
          color: var(--color-warning-600);
          &:hover {
            background: var(--color-warning-200);
          }
        `;
      case 'delete':
        return `
          background: var(--color-error-100);
          color: var(--color-error-600);
          &:hover {
            background: var(--color-error-200);
          }
        `;
      default:
        return `
          background: var(--color-bg-tertiary);
          color: var(--color-text-secondary);
          &:hover {
            background: var(--color-bg-hover);
          }
        `;
    }
  }}

  &:active {
    transform: scale(0.95);
  }
`;

/**
 * 视频统计信息
 */
export const VideoCardStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--color-text-tertiary);

  svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  span {
    display: flex;
    align-items: center;
    gap: 3px;
  }
`;

/**
 * 视频卡片下载按钮
 */
export const VideoCardDownloadBtn = styled.button<{ $status?: 'none' | 'in_list' | 'downloaded' }>`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  ${TouchTarget};
  z-index: 10;

  ${(props) => {
    switch (props.$status) {
      case 'in_list':
        return `
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: var(--color-white);
          &:hover {
            background: var(--color-primary-700);
            transform: scale(1.05);
          }
        `;
      case 'downloaded':
        return `
          background: var(--color-success-500);
          border-color: var(--color-success-500);
          color: var(--color-white);
          &:hover {
            background: var(--color-success-600);
            transform: scale(1.05);
          }
        `;
      default:
        return `
          background: var(--color-white);
          border-color: var(--color-border);
          color: var(--color-text-secondary);
          &:hover {
            background: var(--color-bg-tertiary);
            border-color: var(--color-primary-600);
            color: var(--color-primary-600);
            transform: scale(1.05);
          }
        `;
    }
  }}

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 16px;
    height: 16px;
  }
  
  @media (min-width: 768px) {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
  }
`;

/**
 * 视频卡片复选框按钮（批量模式）
 */
export const VideoCardCheckboxBtn = styled.button<{ $selected?: boolean }>`
  position: absolute;
  top: 8px;
  left: 8px;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  ${TouchTarget};
  z-index: 10;

  background: ${(props) => props.$selected ? 'var(--color-primary-600)' : 'var(--color-white)'};
  border-color: ${(props) => props.$selected ? 'var(--color-primary-600)' : 'var(--color-border)'};
  color: ${(props) => props.$selected ? 'var(--color-white)' : 'transparent'};

  &:hover {
    transform: scale(1.05);
    ${(props) => !props.$selected && `
      border-color: var(--color-primary-600);
      color: var(--color-text-tertiary);
    `}
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

/**
 * 下载速度显示
 */
export const VideoDownloadSpeed = styled.span`
  color: var(--color-primary-500);
  font-weight: 700;
  font-size: 12px;
`;

/**
 * 进度百分比显示
 */
export const VideoProgressText = styled.span`
  color: var(--color-primary-500);
  font-weight: 700;
  font-size: 12px;
`;

/**
 * ETA显示
 */
export const VideoETA = styled.span`
  color: var(--color-text-tertiary);
  font-size: 11px;
`;