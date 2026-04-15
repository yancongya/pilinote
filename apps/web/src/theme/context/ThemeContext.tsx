/**
 * 主题上下文
 * Theme Context
 * 
 * 提供全局主题状态管理和主题切换功能
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ThemeContextValue, ThemeMode, AppTheme, lightTheme, darkTheme } from '..';

// 创建主题上下文
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * 主题上下文 Hook
 * @throws 如果在 ThemeProvider 外部使用会抛出错误
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

/**
 * 主题提供者组件
 * 提供全局主题状态管理
 */
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 从本地存储读取主题偏好
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // 否则使用系统偏好
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // 根据模式获取对应主题
  const theme: AppTheme = mode === 'dark' ? darkTheme : lightTheme;

  // 切换主题
  const toggleTheme = useCallback(() => {
    setModeState(prev => {
      const newMode: ThemeMode = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newMode);
      return newMode;
    });
  }, []);

  // 设置主题
  const setTheme = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme', newMode);
  }, []);

  // 监听系统主题变化（仅当用户没有明确偏好时）
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const hasUserPreference = localStorage.getItem('theme');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (!hasUserPreference) {
        setModeState(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 更新document class以支持CSS变量兼容
  useEffect(() => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  const contextValue: ThemeContextValue = {
    theme,
    isDark: mode === 'dark',
    mode,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * 主题上下文类型导出
 */
export type { ThemeContextValue };