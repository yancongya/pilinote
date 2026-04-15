/**
 * 关键帧动画 - 完整版
 * Keyframe Animations - Complete
 */

import { keyframes } from 'styled-components';

/**
 * 淡入动画
 * 从透明到不透明
 */
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

/**
 * 淡出动画
 * 从不透明到透明
 */
export const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

/**
 * 上滑动画
 * 从下方滑入
 */
export const slideInUp = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

/**
 * 下滑动画
 * 从上方滑入
 */
export const slideInDown = keyframes`
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

/**
 * 左滑动画
 * 从左侧滑入
 */
export const slideInLeft = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

/**
 * 右滑动画
 * 从右侧滑入
 */
export const slideInRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

/**
 * 缩放动画
 * 从小到大缩放
 */
export const scaleIn = keyframes`
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

/**
 * 缩小动画
 * 从大到小缩放
 */
export const scaleOut = keyframes`
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.9);
    opacity: 0;
  }
`;

/**
 * 弹跳动画
 * 弹性缩放效果
 */
export const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
`;

/**
 * 脉冲动画
 * 周期性缩放效果
 */
export const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

/**
 * 旋转动画
 * 360度旋转
 */
export const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

/**
 * 摇晃动画
 * 左右摇晃效果
 */
export const shake = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
`;

/**
 * 闪烁动画
 * 快速闪烁效果
 */
export const blink = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
`;

/**
 * 旋转进入动画
 * 旋转并淡入
 */
export const spinIn = keyframes`
  from {
    transform: rotate(-180deg) scale(0);
    opacity: 0;
  }
  to {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }
`;

/**
 * 展开动画
 * 从中心向外展开
 */
export const expand = keyframes`
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

/**
 * 折叠动画
 * 从外向内折叠
 */
export const collapse = keyframes`
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0);
    opacity: 0;
  }
`;

/**
 * 波纹动画
 * 波浪扩散效果
 */
export const ripple = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
`;

/**
 * 闪烁加载动画
 * 加载时的闪烁效果
 */
export const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;