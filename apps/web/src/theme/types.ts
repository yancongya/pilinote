/**
 * 主题系统类型定义
 * Theme System Type Definitions
 */

/**
 * 应用主题接口
 * 定义完整的主题系统结构
 */
export interface AppTheme {
  // 品牌色系统
  colors: {
    primary: ColorScale;
    secondary: ColorScale;
    functional: {
      success: FunctionalColorScale;
      warning: FunctionalColorScale;
      error: FunctionalColorScale;
      info: FunctionalColorScale;
    };
    semantic: {
      bg: BackgroundColors;
      text: TextColors;
      border: BorderColors;
      divider: string;
      overlay: string;
      overlayLight: string;
    };
  };
  
  // 布局系统
  layout: {
    spacing: SpacingScale;
    borderRadius: BorderRadiusScale;
    zIndex: ZIndexScale;
  };
  
  // 移动端触控系统
  touch: {
    minSize: string;        // 最小触控区域 44px
    mobileMinSize: string;  // 移动端最小 40px
    feedback: string;       // 触控反馈动画时长
    scalePress: string;     // 按压缩放 0.98
    scaleHover: string;     // 悬停缩放 1.02
  };
  
  // 动画系统
  animation: {
    duration: AnimationDuration;
    easing: AnimationEasing;
  };
  
  // 移动优先断点系统
  breakpoints: Breakpoints;
  
  // 阴影系统
  shadows: Shadows;
  
  // 字体系统
  typography: Typography;
}

/**
 * 颜色刻度 (50-950)
 */
export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

/**
 * 功能色刻度 (50-600)
 */
export interface FunctionalColorScale {
  50: string;
  100: string;
  200: string;
  500: string;
  600: string;
}

/**
 * 背景颜色
 */
export interface BackgroundColors {
  primary: string;
  secondary: string;
  tertiary: string;
  hover: string;
}

/**
 * 文本颜色
 */
export interface TextColors {
  primary: string;
  secondary: string;
  tertiary: string;
  disabled: string;
}

/**
 * 边框颜色
 */
export interface BorderColors {
  default: string;
  hover: string;
  active: string;
}

/**
 * 间距刻度
 */
export interface SpacingScale {
  xs: string;   // 4px
  sm: string;   // 8px
  md: string;   // 16px
  lg: string;   // 24px
  xl: string;   // 32px
  '2xl': string; // 48px
  '3xl': string; // 64px
}

/**
 * 边框圆角刻度
 */
export interface BorderRadiusScale {
  sm: string;   // 4px
  md: string;   // 8px
  lg: string;   // 12px
  xl: string;   // 16px
  '2xl': string; // 24px
  full: string; // 9999px
}

/**
 * Z-index层级
 */
export interface ZIndexScale {
  dropdown: number;
  sticky: number;
  fixed: number;
  modalBackdrop: number;
  modal: number;
  popover: number;
  tooltip: number;
}

/**
 * 动画时长
 */
export interface AnimationDuration {
  fast: string;     // 150ms
  base: string;     // 200ms
  slow: string;     // 300ms
  slower: string;   // 400ms
}

/**
 * 动画缓动函数
 */
export interface AnimationEasing {
  ease: string;     // ease-out
  easeIn: string;   // ease-in
  easeOut: string;  // ease-out
  easeInOut: string;// ease-in-out
}

/**
 * 移动优先断点
 */
export interface Breakpoints {
  mobile: string;    // 0-374px
  mobileL: string;   // 375px-767px
  tablet: string;    // 768px-1023px
  desktop: string;   // 1024px+
}

/**
 * 阴影系统
 */
export interface Shadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  primary: string;
  primaryHover: string;
  success: string;
  warning: string;
  error: string;
}

/**
 * 字体系统
 */
export interface Typography {
  fontSize: FontSize;
  fontWeight: FontWeight;
  lineHeight: LineHeight;
}

/**
 * 字体大小
 */
export interface FontSize {
  xs: string; sm: string; base: string; lg: string;
  xl: string; '2xl': string; '3xl': string; '4xl': string;
}

/**
 * 字重
 */
export interface FontWeight {
  normal: string; medium: string; semibold: string; bold: string;
}

/**
 * 行高
 */
export interface LineHeight {
  tight: string; normal: string; relaxed: string;
}

/**
 * 主题模式
 */
export type ThemeMode = 'light' | 'dark';

/**
 * 主题上下文值
 */
export interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}