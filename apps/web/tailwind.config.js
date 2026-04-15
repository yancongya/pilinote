/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // 颜色系统 - 基于 CSS 变量的设计令牌
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          950: 'var(--color-primary-950)',
        },
        secondary: {
          50: 'var(--color-secondary-50)',
          100: 'var(--color-secondary-100)',
          200: 'var(--color-secondary-200)',
          300: 'var(--color-secondary-300)',
          400: 'var(--color-secondary-400)',
          500: 'var(--color-secondary-500)',
          600: 'var(--color-secondary-600)',
          700: 'var(--color-secondary-700)',
          800: 'var(--color-secondary-800)',
          900: 'var(--color-secondary-900)',
          950: 'var(--color-secondary-950)',
        },
        success: {
          50: 'var(--color-success-50)',
          100: 'var(--color-success-100)',
          500: 'var(--color-success-500)',
          600: 'var(--color-success-600)',
        },
        warning: {
          50: 'var(--color-warning-50)',
          100: 'var(--color-warning-100)',
          500: 'var(--color-warning-500)',
          600: 'var(--color-warning-600)',
        },
        error: {
          50: 'var(--color-error-50)',
          100: 'var(--color-error-100)',
          500: 'var(--color-error-500)',
          600: 'var(--color-error-600)',
        },
        info: {
          50: 'var(--color-info-50)',
          100: 'var(--color-info-100)',
          500: 'var(--color-info-500)',
          600: 'var(--color-info-600)',
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
      // 阴影系统 - 基于 CSS 变量
      boxShadow: {
        'settings': 'var(--shadow-md)',
        'settings-hover': 'var(--shadow-lg)',
        'navbar': 'var(--shadow-md)',
        'navbar-hover': 'var(--shadow-lg)',
        'fab': 'var(--shadow-primary)',
        'fab-hover': 'var(--shadow-primary-hover)',
        'fab-error': 'var(--shadow-error)',
        'primary': 'var(--shadow-primary)',
        'primary-hover': 'var(--shadow-primary-hover)',
        'success': 'var(--shadow-success)',
        'warning': 'var(--shadow-warning)',
        'error': 'var(--shadow-error)',
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
      // 过渡时长 - 基于 CSS 变量
      transitionDuration: {
        '150': 'var(--transition-fast)',
        '200': 'var(--transition-base)',
        '300': 'var(--transition-slow)',
        '400': 'var(--transition-slower)',
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