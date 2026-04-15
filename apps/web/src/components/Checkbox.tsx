import React from 'react';
import styled, { css } from 'styled-components';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const CheckboxWrapper = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
`;

const HiddenCheckbox = styled.input.attrs({ type: 'checkbox' })`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
`;

const StyledCheckbox = styled.span<{ $checked: boolean; $disabled: boolean }>`
  position: relative;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: var(--color-primary-500);
  }

  ${({ $checked }) =>
    $checked &&
    css`
      background: var(--color-primary-600);
      border-color: var(--color-primary-600);

      &::after {
        content: '✓';
        color: white;
        font-size: 14px;
        font-weight: bold;
      }
    `}

  ${({ $disabled }) =>
    $disabled &&
    css`
      opacity: 0.5;
      cursor: not-allowed;
    `}
`;

const LabelText = styled.span<{ $disabled: boolean }>`
  font-size: 16px;
  color: var(--color-text-primary);

  ${({ $disabled }) =>
    $disabled &&
    css`
      color: var(--color-text-tertiary);
    `}
`;

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  disabled = false,
  checked,
  onChange,
  ...props
}) => {
  return (
    <CheckboxWrapper>
      <HiddenCheckbox
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <StyledCheckbox $checked={!!checked} $disabled={disabled} />
      {label && <LabelText $disabled={disabled}>{label}</LabelText>}
    </CheckboxWrapper>
  );
};

export default Checkbox;