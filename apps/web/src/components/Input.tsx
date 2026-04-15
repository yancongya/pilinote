import React from 'react';
import styled, { css } from 'styled-components';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

const StyledInput = styled.input<{ $error: boolean; $fullWidth: boolean }>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
  min-height: 44px;

  &:hover {
    border-color: var(--color-primary-400);
  }

  &:focus {
    outline: none;
    border-color: var(--color-primary-600);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  &:disabled {
    background: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
    cursor: not-allowed;
  }

  ${({ $error }) =>
    $error &&
    css`
      border-color: var(--color-error-500);

      &:focus {
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
      }
    `}
`;

export const Input: React.FC<InputProps> = ({
  error = false,
  fullWidth = true,
  disabled,
  ...props
}) => {
  return (
    <StyledInput
      $error={error}
      $fullWidth={fullWidth}
      disabled={disabled}
      {...props}
    />
  );
};

export default Input;