/**
 * MainLayout 组件样式
 * MainLayout Component Styles
 */

import styled, { css } from 'styled-components';
import { fadeIn, slideInUp } from '../../styles/animations/keyframes';
import { SmoothTransition } from '../../styles/animations/transitions';

/**
 * 主容器
 */
export const MainContainer = styled.div<{ $activeTab?: string }>`
  min-height: 100vh;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  
  /* 移动端为底部导航留出空间 */
  @media (max-width: 767px) {
    padding-bottom: 56px;
  }
  
  /* 桌面端无底部导航padding */
  @media (min-width: 768px) {
    padding-bottom: 0;
  }
`;

/**
 * 顶部导航栏
 */
export const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  ${SmoothTransition}
  
  @media (min-width: 768px) {
    padding: 16px 24px;
  }
`;

/**
 * 移动端菜单切换按钮
 */
export const MobileMenuToggle = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  ${SmoothTransition}
  
  &:hover {
    background: var(--color-bg-tertiary);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  @media (min-width: 768px) {
    display: none;
  }
`;

/**
 * 侧边栏内部折叠按钮
 */
export const SidebarCollapseButton = styled.button`
  width: 100%;
  height: 40px;
  border: none;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  ${SmoothTransition}
  margin-top: auto;
  
  &:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }
  
  &:active {
    background: var(--color-bg-hover);
  }
`;

/**
 * 标题区域
 */
export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

/**
 * Logo
 */
export const Logo = styled.h1`
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @media (min-width: 768px) {
    font-size: 24px;
  }
`;

/**
 * 头部右侧区域
 */
export const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

/**
 * 暗色模式切换按钮
 */
export const DarkModeToggle = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  ${SmoothTransition}
  
  &:hover {
    background: var(--color-bg-tertiary);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  @media (min-width: 768px) {
    width: 40px;
    height: 40px;
  }
`;

/**
 * WebSocket状态图标
 */
export const WsStatusIcon = styled.div<{ $connected?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--color-bg-secondary);
  color: ${(props) => (props.$connected ? '#10b981' : '#ef4444')};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  ${SmoothTransition}
  
  &:hover {
    background: var(--color-bg-tertiary);
  }
  
  @media (min-width: 768px) {
    width: 40px;
    height: 40px;
  }
`;

/**
 * 用户信息区域
 */
export const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  ${SmoothTransition}
  
  &:hover {
    background: var(--color-bg-secondary);
  }
  
  &:active {
    background: var(--color-bg-tertiary);
  }
`;

/**
 * 用户头像
 */
export const UserAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-border);
  
  @media (min-width: 768px) {
    width: 40px;
    height: 40px;
  }
`;

/**
 * 游客头像容器
 */
export const GuestAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border);
  
  @media (min-width: 768px) {
    width: 40px;
    height: 40px;
  }
`;

/**
 * 用户名
 */
export const UserName = styled.span`
  font-size: 14px;
  font-weight: 600;
  display: none;
  
  @media (min-width: 768px) {
    display: block;
  }
`;

/**
 * 认证状态指示器
 */
export const AuthStatus = styled.div<{ $status?: 'initialized' | 'pending' | 'error' }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  color: white;
  background: ${(props) => {
    switch (props.$status) {
      case 'initialized':
        return '#10b981';
      case 'error':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  }}
`;

/**
 * 主内容区域
 */
export const MainContent = styled.div`
  display: flex;
  min-height: calc(100vh - 56px);
  
  @media (min-width: 768px) {
    min-height: calc(100vh - 72px);
  }
`;

/**
 * 侧边栏（桌面端）
 */
export const Sidebar = styled.aside<{ $width?: number; $collapsed?: boolean }>`
  width: ${props => props.$collapsed ? '70px' : props.$width || 240}px;
  padding: 16px 0;
  border-right: 1px solid var(--color-border);
  position: relative;
  z-index: 50;
  display: flex;
  flex-direction: column;
  ${SmoothTransition}
  
  /* 桌面端显示 */
  @media (min-width: 768px) {
    display: flex;
  }
  
  /* 移动端隐藏 */
  @media (max-width: 767px) {
    display: none;
  }
`;

/**
 * 侧边栏拖拽手柄
 */
export const SidebarDragHandle = styled.div<{ $isDragging?: boolean }>`
  position: absolute;
  right: -6px;
  top: 0;
  bottom: 0;
  width: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  z-index: 60;
  opacity: 0;
  ${SmoothTransition}
  
  &:hover {
    opacity: 1;
    background: rgba(37, 99, 235, 0.1);
  }
  
  ${(props) => props.$isDragging && css`
    opacity: 1;
    background: rgba(37, 99, 235, 0.2);
  `}
  
  color: var(--color-text-tertiary);
`;

/**
 * 移动端侧边栏遮罩
 */
export const MobileSidebarOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  animation: ${fadeIn} 0.2s ease;
  
  @media (min-width: 768px) {
    display: none;
  }
`;

/**
 * 侧边栏导航
 */
export const SidebarNav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

/**
 * 侧边栏标签
 */
export const SidebarTab = styled.button<{ $active?: boolean; $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.$collapsed ? '0' : '12px'};
  padding: ${props => props.$collapsed ? '12px' : '12px 16px'};
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  justify-content: ${props => props.$collapsed ? 'center' : 'flex-start'};
  ${SmoothTransition}
  
  ${(props) =>
    props.$active &&
    css`
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    `}
  
  &:hover {
    background: var(--color-bg-secondary);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  @media (min-width: 768px) {
    font-size: 15px;
    padding: ${props => props.$collapsed ? '14px' : '14px 20px'};
  }
  
  /* 收缩状态下隐藏文本标签 */
  .sidebar-label {
    display: ${props => props.$collapsed ? 'none' : 'block'};
    white-space: nowrap;
  }
  
  .sidebar-icon {
    flex-shrink: 0;
  }
`;

/**
 * 侧边栏图标
 */
export const SidebarIcon = styled.svg<{ $active?: boolean }>`
  width: 20px;
  height: 20px;
  color: ${(props) => (props.$active ? 'var(--color-primary-600)' : 'currentColor')};
`;

/**
 * 内容区域
 */
export const ContentArea = styled.main`
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  
  @media (min-width: 768px) {
    padding: 24px;
  }
`;

/**
 * 内容包装器
 */
export const ContentWrapper = styled.div`
  animation: ${fadeIn} 0.3s ease;
`;

/**
 * 底部导航栏（移动端）
 */
export const BottomNav = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1000;
  padding-bottom: env(safe-area-inset-bottom);
  ${SmoothTransition}
  
  /* 移动端显示 */
  @media (max-width: 767px) {
    display: flex !important;
  }
  
  /* 桌面端隐藏 */
  @media (min-width: 768px) {
    display: none !important;
  }
`;

/**
 * 底部导航项
 */
export const NavItem = styled.button<{ $active?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  ${SmoothTransition}
  min-height: 56px; /* 移动端最小触控目标 */
  
  ${(props) =>
    props.$active &&
    css`
      color: var(--color-primary-600);
    `}
  
  &:active {
    transform: scale(0.95);
  }
`;

/**
 * 底部导航图标
 */
export const NavIcon = styled.svg<{ $active?: boolean }>`
  width: 24px;
  height: 24px;
  color: ${(props) => (props.$active ? 'var(--color-primary-600)' : 'currentColor')};
`;

/**
 * 底部导航标签
 */
export const NavLabel = styled.span<{ $active?: boolean }>`
  font-size: 11px;
  font-weight: ${(props) => (props.$active ? '600' : '500')};
`;

/**
 * 退出登录确认遮罩
 */
export const LogoutOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
  animation: ${fadeIn} 0.2s ease;
`;

/**
 * 退出登录确认面板
 */
export const LogoutPanel = styled.div`
  background: var(--color-bg-primary);
  border-radius: 16px;
  padding: 24px;
  max-width: 320px;
  width: 100%;
  animation: ${slideInUp} 0.3s ease;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
`;

/**
 * 退出确认消息
 */
export const LogoutMessage = styled.p`
  font-size: 15px;
  color: var(--color-text-primary);
  text-align: center;
  margin-bottom: 20px;
  line-height: 1.5;
`;

/**
 * 退出确认按钮容器
 */
export const LogoutButtons = styled.div`
  display: flex;
  gap: 12px;
`;

/**
 * 主要按钮
 */
export const PrimaryButton = styled.button`
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  ${SmoothTransition}
  min-height: 44px; /* 移动端最小触控目标 */
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

/**
 * 次要按钮
 */
export const SecondaryButton = styled.button`
  flex: 1;
  padding: 12px 20px;
  border: 2px solid #6366f1;
  border-radius: 8px;
  background: transparent;
  color: #6366f1;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  ${SmoothTransition}
  min-height: 44px; /* 移动端最小触控目标 */
  
  &:hover {
    background: rgba(99, 102, 241, 0.1);
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

/**
 * 登录提示容器
 */
export const LoginPromptContainer = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px 20px;
  text-align: center;
  animation: ${fadeIn} 0.3s ease;
`;

/**
 * 空状态图标
 */
export const EmptyStateIcon = styled.svg`
  width: 64px;
  height: 64px;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
  
  @media (min-width: 768px) {
    width: 80px;
    height: 80px;
  }
`;

/**
 * 登录提示标题
 */
export const LoginPromptTitle = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 12px;
  
  @media (min-width: 768px) {
    font-size: 22px;
  }
`;

/**
 * 登录提示消息
 */
export const LoginPromptMessage = styled.p`
  font-size: 15px;
  color: var(--color-text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
  max-width: 400px;
`;

/**
 * 登录按钮
 */
export const LoginButton = styled.button`
  padding: 12px 32px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  ${SmoothTransition}
  min-height: 44px; /* 移动端最小触控目标 */
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;