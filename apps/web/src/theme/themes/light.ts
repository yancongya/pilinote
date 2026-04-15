/**
 * 亮色主题定义
 * Light Theme Definition
 * 
 * 基于现有的 design-tokens.css 亮色模式配置
 */

import { AppTheme } from '../types';

export const lightTheme: AppTheme = {
  colors: {
    // 品牌色
    primary: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
      950: '#172554',
    },
    secondary: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
      950: '#020617',
    },
    functional: {
      success: {
        50: '#F0FDF4',
        100: '#DCFCE7',
        200: '#BBF7D0',
        500: '#22C55E',
        600: '#16A34A',
      },
      warning: {
        50: '#FFFBEB',
        100: '#FEF3C7',
        200: '#FDE68A',
        500: '#F59E0B',
        600: '#D97706',
      },
      error: {
        50: '#FEF2F2',
        100: '#FEE2E2',
        200: '#FECACA',
        500: '#EF4444',
        600: '#DC2626',
      },
      info: {
        50: '#EFF6FF',
        100: '#DBEAFE',
        200: '#BFDBFE',
        500: '#3B82F6',
        600: '#2563EB',
      },
    },
    semantic: {
      bg: {
        primary: '#FFFFFF',
        secondary: '#F8FAFC',
        tertiary: '#F1F5F9',
        hover: '#F3F4F6',
      },
      text: {
        primary: '#1E293B',
        secondary: '#64748B',
        tertiary: '#94A3B8',
        disabled: '#9CA3AF',
      },
      border: {
        default: '#E2E8F0',
        hover: '#CBD5E1',
        active: '#2563EB',
      },
      divider: '#E5E7EB',
      overlay: 'rgba(0, 0, 0, 0.5)',
      overlayLight: 'rgba(0, 0, 0, 0.1)',
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
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
    '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
    primary: '0 4px 12px rgba(37, 99, 235, 0.15)',
    primaryHover: '0 8px 24px rgba(37, 99, 235, 0.25)',
    success: '0 4px 12px rgba(34, 197, 94, 0.15)',
    warning: '0 4px 12px rgba(245, 158, 11, 0.15)',
    error: '0 4px 12px rgba(239, 68, 68, 0.15)',
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