/**
 * 卡片组件样式 - 完整版
 * Card Component Styles - Complete
 */

import styled, { css } from 'styled-components';
import { BaseTransition } from '../animations/transitions';
import { HoverEffect } from '../animations/micro-interactions';

/**
 * 基础卡片样式
 * 移动优先，触控优化
 */
export const BaseCard = styled.div<{ $elevated?: boolean; $clickable?: boolean }>`
  /* 移动优先 - 默认为移动端样式 */
  background-color: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 12px;
  ${BaseTransition}
  
  /* 桌面端样式调整 */
  @media (min-width: 768px) {
    padding: 20px;
    margin-bottom: 16px;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  /* 悬浮效果 */
  ${(props) => props.$elevated && css`
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    
    @media (min-width: 768px) {
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    }
  `}
  
  /* 可点击效果 */
  ${(props) => props.$clickable && css`
    cursor: pointer;
    
    &:active {
      transform: scale(0.98);
    }
    
    @media (hover: hover) {
      ${HoverEffect}
    }
  `}
`;

/**
 * 视频卡片
 */
export const VideoCard = styled(BaseCard)<{ $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  
  /* 紧凑模式 */
  ${(props) => props.$compact && css`
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 12px;
    
    @media (min-width: 768px) {
      gap: 16px;
      padding: 16px;
    }
  `}
  
  /* 缩略图容器 */
  .thumbnail-container {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    
    ${(props) => props.$compact && css`
      width: 120px;
      height: 68px;
      flex-shrink: 0;
      
      @media (min-width: 768px) {
        width: 160px;
        height: 90px;
      }
    `}
  }
  
  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  /* 时长标记 */
  .duration {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    
    @media (min-width: 768px) {
      font-size: 11px;
    }
  }
  
  /* 视频信息 */
  .video-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    ${(props) => props.$compact && css`
      gap: 4px;
    `}
  }
  
  .video-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    
    @media (min-width: 768px) {
      font-size: 15px;
      -webkit-line-clamp: 2;
    }
    
    ${(props) => props.$compact && css`
      font-size: 13px;
      -webkit-line-clamp: 1;
      
      @media (min-width: 768px) {
        font-size: 14px;
      }
    `}
  }
  
  .video-meta {
    display: flex;
    gap: 8px;
    font-size: 12px;
    color: #6b7280;
    
    @media (min-width: 768px) {
      font-size: 13px;
    }
  }
`;

/**
 * 文件夹卡片
 */
export const FolderCard = styled(BaseCard)<{ $grid?: boolean }>`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  /* 网格模式 */
  ${(props) => props.$grid && css`
    margin-bottom: 0;
  `}
  
  /* 文件夹图标 */
  .folder-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;
    color: #6366f1;
    
    @media (min-width: 768px) {
      width: 56px;
      height: 56px;
      margin-bottom: 16px;
    }
  }
  
  /* 文件夹名称 */
  .folder-name {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
    
    @media (min-width: 768px) {
      font-size: 15px;
    }
  }
  
  /* 文件夹统计 */
  .folder-stats {
    font-size: 12px;
    color: #6b7280;
    
    @media (min-width: 768px) {
      font-size: 13px;
    }
  }
`;

/**
 * 设置卡片
 */
export const SettingCard = styled(BaseCard)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 56px;
  
  /* 设置内容 */
  .setting-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .setting-label {
    font-size: 14px;
    font-weight: 600;
    
    @media (min-width: 768px) {
      font-size: 15px;
    }
  }
  
  .setting-description {
    font-size: 12px;
    color: #6b7280;
    
    @media (min-width: 768px) {
      font-size: 13px;
    }
  }
  
  /* 设置控件 */
  .setting-control {
    margin-left: 16px;
    flex-shrink: 0;
  }
`;

/**
 * 任务卡片
 */
export const TaskCard = styled(BaseCard)<{ $status?: 'pending' | 'processing' | 'completed' | 'failed' }>`
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  /* 任务头部 */
  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  
  .task-title {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    
    @media (min-width: 768px) {
      font-size: 15px;
    }
  }
  
  .task-status {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
    
    ${(props) => {
      switch (props.$status) {
        case 'pending':
          return css`
            background: #fef3c7;
            color: #92400e;
          `;
        case 'processing':
          return css`
            background: #dbeafe;
            color: #1e40af;
          `;
        case 'completed':
          return css`
            background: #d1fae5;
            color: #065f46;
          `;
        case 'failed':
          return css`
            background: #fee2e2;
            color: #991b1b;
          `;
        default:
          return css`
            background: #f3f4f6;
            color: #374151;
          `;
      }
    }}
  }
  
  /* 进度条 */
  .task-progress {
    width: 100%;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
    transition: width 0.3s ease;
  }
  
  /* 任务信息 */
  .task-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #6b7280;
    
    @media (min-width: 768px) {
      font-size: 13px;
    }
  }
`;

/**
 * 卡片网格容器
 */
export const CardGrid = styled.div<{ $columns?: 1 | 2 | 3 | 4 }>`
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  
  @media (min-width: 768px) {
    gap: 16px;
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  ${(props) => {
    switch (props.$columns) {
      case 1:
        return css`
          grid-template-columns: 1fr;
        `;
      case 2:
        return css`
          @media (min-width: 768px) {
            grid-template-columns: repeat(2, 1fr);
          }
        `;
      case 3:
        return css`
          @media (min-width: 768px) {
            grid-template-columns: repeat(2, 1fr);
          }
          @media (min-width: 1024px) {
            grid-template-columns: repeat(3, 1fr);
          }
        `;
      case 4:
        return css`
          @media (min-width: 768px) {
            grid-template-columns: repeat(2, 1fr);
          }
          @media (min-width: 1024px) {
            grid-template-columns: repeat(4, 1fr);
          }
        `;
      default:
        return '';
    }
  }}
`;