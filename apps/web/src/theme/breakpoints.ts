/**
 * 移动优先断点系统
 * Mobile First Breakpoint System
 * 
 * 提供移动优先的响应式断点管理
 */

import { useState, useEffect } from 'react';

/**
 * 断点定义
 * 基于移动优先的设计原则
 */
export const breakpoints = {
  mobile: '0px',       // 默认移动端 (0-374px)
  mobileL: '375px',    // 大屏手机 (375px-767px)
  tablet: '768px',     // 平板 (768px-1023px)
  desktop: '1024px'    // 桌面 (1024px+)
} as const;

/**
 * 断点类型
 */
export type Breakpoint = keyof typeof breakpoints;

/**
 * 媒体查询工具
 * 生成移动优先的媒体查询字符串
 */
export const media = {
  mobile: '@media (max-width: 374px)',
  mobileL: '@media (min-width: 375px) and (max-width: 767px)',
  tablet: '@media (min-width: 768px) and (max-width: 1023px)',
  desktop: '@media (min-width: 1024px)',
  
  // 大屏断点
  tabletAndUp: '@media (min-width: 768px)',
  desktopAndUp: '@media (min-width: 1024px)',
  
  // 小屏断点
  tabletAndDown: '@media (max-width: 1023px)',
  mobileAndDown: '@media (max-width: 767px)',
} as const;

/**
 * 断点信息
 */
export interface BreakpointInfo {
  name: Breakpoint;
  isMobile: boolean;
  isMobileL: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  currentBreakpoint: Breakpoint;
}

/**
 * 获取当前断点信息
 */
export const getCurrentBreakpoint = (): BreakpointInfo => {
  const width = window.innerWidth;
  
  let currentBreakpoint: Breakpoint = 'mobile';
  if (width >= 1024) {
    currentBreakpoint = 'desktop';
  } else if (width >= 768) {
    currentBreakpoint = 'tablet';
  } else if (width >= 375) {
    currentBreakpoint = 'mobileL';
  }
  
  return {
    name: currentBreakpoint,
    isMobile: width < 375,
    isMobileL: width >= 375 && width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    currentBreakpoint,
  };
};

/**
 * 断点 Hook
 * 提供响应式断点信息
 */
export const useBreakpoint = (): BreakpointInfo => {
  const [breakpointInfo, setBreakpointInfo] = useState<BreakpointInfo>(getCurrentBreakpoint());
  
  useEffect(() => {
    const handleResize = () => {
      setBreakpointInfo(getCurrentBreakpoint());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return breakpointInfo;
};

/**
 * 移动端 Hook
 * 快速检查是否为移动端
 */
export const useMobile = (): boolean => {
  const { isMobile } = useBreakpoint();
  return isMobile;
};

/**
 * 桌面端 Hook
 * 快速检查是否为桌面端
 */
export const useDesktop = (): boolean => {
  const { isDesktop } = useBreakpoint();
  return isDesktop;
};