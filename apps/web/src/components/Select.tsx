import React from 'react';
import styled from 'styled-components';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  fullWidth?: boolean;
}

const StyledSelect = styled.select<{ $fullWidth: boolean }>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 20px;
  padding-right: 44px;

  &:hover:not(:disabled) {
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
    opacity: 0.7;
  }

  option {
    padding: 8px 12px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  &:disabled option {
    background: var(--color-bg-tertiary);
  }
`;

export const Select: React.FC<SelectProps> = ({
  fullWidth = true,
  disabled,
  children,
  ...props
}) => {
  return (
    <StyledSelect
      $fullWidth={fullWidth}
      disabled={disabled}
      {...props}
    >
      {children}
    </StyledSelect>
  );
};

export default Select;