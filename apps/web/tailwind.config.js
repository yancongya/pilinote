/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // 颜色系统 - 基于设计令牌
      colors: {
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
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
        },
      },
      // 间距系统 (8px增量)
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      // 边框圆角
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      // 阴影系统
      boxShadow: {
        'settings': '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'settings-hover': '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
        'navbar': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'navbar-hover': '0 8px 32px rgba(0, 0, 0, 0.12)',
        'fab': '0 4px 16px rgba(37, 99, 235, 0.3)',
        'fab-hover': '0 8px 24px rgba(37, 99, 235, 0.4)',
        'fab-error': '0 4px 16px rgba(220, 38, 38, 0.3)',
      },
      // 背景模糊
      backdropBlur: {
        'settings': '12px',
        'navbar': '20px',
      },
      // 动画
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease',
        'pulse-slow': 'pulse 1.5s infinite',
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      // 过渡时长
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '400': '400ms',
      },
      // 容器最大宽度
      maxWidth: {
        'settings': '768px',
        'settings-lg': '1024px',
        'settings-xl': '1280px',
      },
      // 最小高度
      minHeight: {
        'touch': '44px',
        'touch-mobile': '40px',
        'navbar': '48px',
        'navbar-mobile': '44px',
      },
      // 最小宽度
      minWidth: {
        'touch': '44px',
        'touch-mobile': '40px',
      },
      // 字体大小（用于设置页面特定的大小）
      fontSize: {
        'settings-label': ['14px', { lineHeight: '1.5' }],
        'settings-value': ['16px', { lineHeight: '1.5' }],
        'settings-title': ['20px', { lineHeight: '1.2', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
}