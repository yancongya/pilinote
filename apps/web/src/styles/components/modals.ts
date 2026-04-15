/**
 * 模态框组件样式
 * Modal Component Styles
 */

import styled from 'styled-components';

// 模态框遮罩
export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  
  /* 触控优化 - 点击遮罩关闭 */
  cursor: pointer;
`;

// 模态框内容
export const ModalContent = styled.div`
  background-color: #ffffff;
  border-radius: 16px;
  padding: 24px;
  max-width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  
  /* 触控优化 */
  cursor: default;
  
  /* 桌面端 */
  @media (min-width: 768px) {
    max-width: 500px;
  }
`;