/**
 * 暗色主题定义
 * Dark Theme Definition
 * 
 * 基于现有的 design-tokens.css 暗色模式配置
 */

import { AppTheme } from '../types';

export const darkTheme: AppTheme = {
  colors: {
    // 品牌色 - 暗色模式下保持不变
    primary: {
      50: 'rgba(59, 130, 246, 0.1)',
      100: 'rgba(59, 130, 246, 0.2)',
      200: 'rgba(59, 130, 246, 0.3)',
      300: 'rgba(59, 130, 246, 0.4)',
      400: 'rgba(59, 130, 246, 0.5)',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
      950: '#172554',
    },
    secondary: {
      50: '#0F172A',
      100: '#1E293B',
      200: '#334155',
      300: '#475569',
      400: '#64748B',
      500: '#94A3B8',
      600: '#CBD5E1',
      700: '#E2E8F0',
      800: '#F1F5F9',
      900: '#F8FAFC',
      950: '#FFFFFF',
    },
    functional: {
      success: {
        50: 'rgba(34, 197, 94, 0.1)',
        100: 'rgba(34, 197, 94, 0.15)',
        200: 'rgba(34, 197, 94, 0.2)',
        500: '#22C55E',
        600: '#16A34A',
      },
      warning: {
        50: 'rgba(245, 158, 11, 0.1)',
        100: 'rgba(245, 158, 11, 0.15)',
        200: 'rgba(245, 158, 11, 0.2)',
        500: '#F59E0B',
        600: '#D97706',
      },
      error: {
        50: 'rgba(239, 68, 68, 0.1)',
        100: 'rgba(239, 68, 68, 0.15)',
        200: 'rgba(239, 68, 68, 0.2)',
        500: '#EF4444',
        600: '#DC2626',
      },
      info: {
        50: 'rgba(59, 130, 246, 0.1)',
        100: 'rgba(59, 130, 246, 0.15)',
        200: 'rgba(59, 130, 246, 0.2)',
        500: '#3B82F6',
        600: '#2563EB',
      },
    },
    semantic: {
      bg: {
        primary: '#0f0f0f',   // 纯黑色
        secondary: '#1a1a1a', // 深灰
        tertiary: '#2a2a2a',  // 中灰
        hover: '#3a3a3a',
      },
      text: {
        primary: '#E0E0E0',
        secondary: '#94A3B8',
        tertiary: '#64748B',
        disabled: '#475569',
      },
      border: {
        default: '#2a2a2a',
        hover: '#3a3a3a',
        active: '#2563EB',
      },
      divider: '#2a2a2a',
      overlay: 'rgba(0, 0, 0, 0.7)',
      overlayLight: 'rgba(255, 255, 255, 0.1)',
    },
  },
  
  layout: {
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      '2xl': '48px',
      '3xl': '64px',
    },
    borderRadius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      '2xl': '24px',
      full: '9999px',
    },
    zIndex: {
      dropdown: 1000,
      sticky: 1020,
      fixed: 1030,
      modalBackdrop: 1040,
      modal: 1050,
      popover: 1060,
      tooltip: 1070,
    },
  },
  
  touch: {
    minSize: '44px',
    mobileMinSize: '40px',
    feedback: '100ms',
    scalePress: '0.98',
    scaleHover: '1.02',
  },
  
  animation: {
    duration: {
      fast: '150ms',
      base: '200ms',
      slow: '300ms',
      slower: '400ms',
    },
    easing: {
      ease: 'ease-out',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },
  
  breakpoints: {
    mobile: '0px',       // 默认移动端 (0-374px)
    mobileL: '375px',    // 大屏手机 (375px-767px)
    tablet: '768px',     // 平板 (768px-1023px)
    desktop: '1024px',   // 桌面 (1024px+)
  },
  
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.6)',
    '2xl': '0 25px 50px rgba(0, 0, 0, 0.7)',
    primary: '0 4px 12px rgba(37, 99, 235, 0.3)',
    primaryHover: '0 8px 24px rgba(37, 99, 235, 0.4)',
    success: '0 4px 12px rgba(34, 197, 94, 0.3)',
    warning: '0 4px 12px rgba(245, 158, 11, 0.3)',
    error: '0 4px 12px rgba(239, 68, 68, 0.3)',
  },
  
  typography: {
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
};