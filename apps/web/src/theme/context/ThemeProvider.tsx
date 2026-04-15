/**
 * 主题提供者
 * Theme Provider
 * 
 * 包装 styled-components ThemeProvider 和自定义主题上下文
 */

import { ReactNode } from 'react';
import { ThemeProvider as StyledComponentsThemeProvider } from 'styled-components';
import { ThemeProvider as CustomThemeProvider } from './ThemeContext';
import { useTheme } from './ThemeContext';

/**
 * 统一的主题提供者
 * 同时提供 styled-components 主题支持和自定义主题上下文
 */
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <CustomThemeProvider>
      <ThemeConsumer>
        {children}
      </ThemeConsumer>
    </CustomThemeProvider>
  );
};

/**
 * 主题消费者组件
 * 将主题传递给 styled-components ThemeProvider
 */
const ThemeConsumer: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  
  // 确保主题对象包含所有必要的属性
  const styledTheme = {
    ...theme,
    // 添加CSS变量访问
    colors: {
      ...theme.colors,
      // 确保可以直接通过CSS变量访问
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      functional: theme.colors.functional,
      semantic: theme.colors.semantic,
    },
  };
  
  return (
    <StyledComponentsThemeProvider theme={styledTheme}>
      {children}
    </StyledComponentsThemeProvider>
  );
};