/**
 * 微交互效果 - 完整版
 * Micro-interactions - Complete
 */

import styled, { css } from 'styled-components';
import { scaleIn, shake, pulse } from './keyframes';

/**
 * 悬停效果（桌面端）
 * 鼠标悬停时的视觉反馈
 */
export const HoverEffect = css`
  @media (hover: hover) {
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }
`;

/**
 * 悬停发光效果
 * 鼠标悬停时带有发光效果
 */
export const HoverGlow = css`
  @media (hover: hover) {
    &:hover {
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    }
  }
`;

/**
 * 悬停缩放效果
 * 鼠标悬停时轻微缩放
 */
export const HoverScale = css`
  @media (hover: hover) {
    &:hover {
      transform: scale(1.05);
    }
  }
`;

/**
 * 悬停颜色变化
 * 鼠标悬停时改变颜色
 */
export const HoverColor = css<{ hoverColor?: string }>`
  @media (hover: hover) {
    &:hover {
      background-color: ${(props) => props.hoverColor || '#6366f1'};
      color: white;
    }
  }
`;

/**
 * 焦点效果
 * 键盘焦点时的可访问性效果
 */
export const FocusEffect = css`
  &:focus {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }
  
  &:focus:not(:focus-visible) {
    outline: none;
  }
`;

/**
 * 焦点内发光
 * 焦点时带有内发光效果
 */
export const FocusInnerGlow = css`
  &:focus {
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }
  
  &:focus:not(:focus-visible) {
    box-shadow: none;
  }
`;

/**
 * 触控高亮
 * 移动端触控时的高亮效果
 */
export const TouchHighlight = css`
  &:active {
    background-color: rgba(99, 102, 241, 0.1);
  }
`;

/**
 * 加载动画
 * 旋转的加载指示器
 */
export const LoadingSpinner = styled.div<{ size?: number; color?: string }>`
  width: ${(props) => props.size || 24}px;
  height: ${(props) => props.size || 24}px;
  border: 3px solid ${(props) => props.color || '#e0e0e0'};
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

/**
 * 脉冲加载动画
 * 脉冲式的加载指示器
 */
export const PulseLoader = styled.div<{ size?: number }>`
  width: ${(props) => props.size || 40}px;
  height: ${(props) => props.size || 40}px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  animation: pulse-scale 1.5s ease-in-out infinite;
  
  @keyframes pulse-scale {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.7;
    }
  }
`;

/**
 * 点状加载动画
 * 三个点的加载动画
 */
export const DotLoader = styled.div<{ size?: number }>`
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  
  span {
    width: ${(props) => props.size || 8}px;
    height: ${(props) => props.size || 8}px;
    border-radius: 50%;
    background: #6366f1;
    animation: dot-pulse 1.4s ease-in-out infinite;
    
    &:nth-child(1) {
      animation-delay: 0s;
    }
    
    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
  
  @keyframes dot-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.5);
      opacity: 0.5;
    }
  }
`;

/**
 * 进度条动画
 */
export const AnimatedProgress = styled.div<{ progress: number; color?: string }>`
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: ${(props) => props.progress}%;
    background: ${(props) => props.color || 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)'};
    border-radius: 2px;
    transition: width 0.3s ease;
  }
`;

/**
 * 错误摇晃动画
 */
export const ErrorShake = styled.div<{ isError?: boolean }>`
  ${(props) => props.isError && css`
    animation: ${shake} 0.5s ease-in-out;
  `}
`;

/**
 * 成功脉冲动画
 */
export const SuccessPulse = styled.div<{ isSuccess?: boolean }>`
  ${(props) => props.isSuccess && css`
    animation: ${pulse} 0.5s ease-in-out;
  `}
`;

/**
 * 工具提示动画
 */
export const Tooltip = styled.div<{ visible?: boolean }>`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: ${(props) => (props.visible ? 1 : 0)};
  animation: ${(props) => (props.visible ? scaleIn : 'fadeOut')} 0.2s ease;
  z-index: 1000;
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #1f2937;
  }
`;

/**
 * 按钮波纹效果
 */
export const RippleEffect = styled.button`
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: width 0.6s ease, height 0.6s ease;
  }
  
  &:active::after {
    width: 300px;
    height: 300px;
  }
`;

/**
 * 骨架屏加载效果
 */
export const Skeleton = styled.div<{ width?: string; height?: string }>`
  width: ${(props) => props.width || '100%'};
  height: ${(props) => props.height || '16px'};
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  border-radius: 4px;
  animation: skeleton-loading 1.5s infinite;
  
  @keyframes skeleton-loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;