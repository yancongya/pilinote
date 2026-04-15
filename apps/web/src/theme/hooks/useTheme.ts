/**
 * 主题 Hooks
 * Theme Hooks
 * 
 * 提供便捷的主题访问和操作方法
 */

import { useTheme as useCustomTheme } from '../context/ThemeContext';
import type { AppTheme } from '../types';

/**
 * 获取当前主题
 * 这是一个兼容性 Hook，可以同时用于 styled-components 和自定义主题上下文
 */
export const useTheme = (): AppTheme => {
  const customTheme = useCustomTheme();
  return customTheme.theme;
};

/**
 * 获取主题模式和切换函数
 */
export const useThemeMode = () => {
  return useCustomTheme();
};

/**
 * 获取主题状态（是否为暗色模式）
 */
export const useDarkMode = () => {
  const { isDark } = useThemeMode();
  return isDark;
};

/**
 * 获取主题切换函数
 */
export const useToggleTheme = () => {
  const { toggleTheme } = useThemeMode();
  return toggleTheme;
};