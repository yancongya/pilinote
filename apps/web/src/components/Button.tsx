import React from 'react';
import styled, { css } from 'styled-components';

// 按钮类型
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
// 按钮尺寸
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const getVariantStyles = (variant: ButtonVariant) => {
  switch (variant) {
    case 'primary':
      return css`
        background: var(--color-primary-600);
        color: white;
        border: none;

        &:hover:not(:disabled) {
          background: var(--color-primary-700);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }
      `;
    case 'secondary':
      return css`
        background: var(--color-bg-primary);
        color: var(--color-primary-600);
        border: 1px solid var(--color-primary-600);

        &:hover:not(:disabled) {
          background: var(--color-primary-50);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }
      `;
    case 'ghost':
      return css`
        background: transparent;
        color: var(--color-text-primary);
        border: none;

        &:hover:not(:disabled) {
          background: var(--color-bg-tertiary);
        }

        &:active:not(:disabled) {
          background: var(--color-bg-secondary);
        }
      `;
    case 'danger':
      return css`
        background: var(--color-error-500);
        color: white;
        border: none;

        &:hover:not(:disabled) {
          background: var(--color-error-600);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }
      `;
    case 'icon':
      return css`
        background: transparent;
        color: var(--color-text-secondary);
        border: none;
        padding: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 40px;

        &:hover:not(:disabled) {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        &:active:not(:disabled) {
          background: var(--color-bg-secondary);
        }
      `;
    default:
      return css``;
  }
};

const getSizeStyles = (size: ButtonSize) => {
  switch (size) {
    case 'sm':
      return css`
        padding: 8px 16px;
        font-size: 14px;
        min-height: 36px;
      `;
    case 'md':
      return css`
        padding: 12px 24px;
        font-size: 16px;
        min-height: 44px;
      `;
    case 'lg':
      return css`
        padding: 16px 32px;
        font-size: 18px;
        min-height: 52px;
      `;
    default:
      return css``;
  }
};

const StyledButton = styled.button<{
  $variant: ButtonVariant;
  $size: ButtonSize;
  $loading: boolean;
  $fullWidth: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  ${({ $variant }) => getVariantStyles($variant)}
  ${({ $size }) => getSizeStyles($size)}

  ${({ $fullWidth }) =>
    $fullWidth &&
    css`
      width: 100%;
    `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  ${({ $loading }) =>
    $loading &&
    css`
      pointer-events: none;
      opacity: 0.8;
    `}

  ${({ $loading }) =>
    $loading &&
    css`
      &::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `}
`;

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  ...props
}) => {
  return (
    <StyledButton
      $variant={variant}
      $size={size}
      $loading={loading}
      $fullWidth={fullWidth}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? null : icon}
      {loading ? '加载中...' : children}
    </StyledButton>
  );
};

export default Button;