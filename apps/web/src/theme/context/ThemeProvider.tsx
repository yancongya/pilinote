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
  return (
    <StyledComponentsThemeProvider theme={theme}>
      {children}
    </StyledComponentsThemeProvider>
  );
};