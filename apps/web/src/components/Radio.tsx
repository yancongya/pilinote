import React from 'react';
import styled, { css } from 'styled-components';

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const RadioWrapper = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
`;

const HiddenRadio = styled.input.attrs({ type: 'radio' })`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
`;

const StyledRadio = styled.span<{ $checked: boolean; $disabled: boolean }>`
  position: relative;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary-500);
  }

  ${({ $checked }) =>
    $checked &&
    css`
      border-color: var(--color-primary-600);

      &::after {
        content: '';
        position: absolute;
        width: 10px;
        height: 10px;
        background: var(--color-primary-600);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
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

export const Radio: React.FC<RadioProps> = ({
  label,
  disabled = false,
  checked,
  onChange,
  ...props
}) => {
  return (
    <RadioWrapper>
      <HiddenRadio
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <StyledRadio $checked={!!checked} $disabled={disabled} />
      {label && <LabelText $disabled={disabled}>{label}</LabelText>}
    </RadioWrapper>
  );
};

export default Radio;