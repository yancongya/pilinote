import styled from 'styled-components'
import { ChevronLeft } from 'lucide-react'
import Button from './Button'

export interface SectionHeaderProps {
  /** 标题 */
  title: string
  /** 副标题/描述 */
  subtitle?: string
  /** 统计信息（如视频数量） */
  count?: number | string
  /** 是否显示返回按钮 */
  showBackButton?: boolean
  /** 返回按钮点击回调 */
  onBack?: () => void
  /** 返回按钮图标 */
  backIcon?: React.ReactNode
  /** 图标 */
  icon?: React.ReactNode
  /** 右侧操作区域 */
  actions?: React.ReactNode
  /** 额外的类名 */
  className?: string
  /** 是否紧凑模式 */
  compact?: boolean
}

// Styled Components
const HeaderContainer = styled.div<{ $compact: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  padding: ${({ $compact }) => ($compact ? 'var(--spacing-md) 0' : 'var(--spacing-lg) 0')};
  transition: all 0.2s ease;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
  min-width: 0;
`

const BackButton = styled(Button).attrs({ variant: 'ghost', size: 'sm' })`
  padding: var(--spacing-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  flex-shrink: 0;
`

const TitleIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-primary-600);
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    width: 32px;
    height: 32px;
  }
`

const TitleContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;
`

const Title = styled.h2`
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  @media (max-width: 768px) {
    font-size: var(--font-size-lg);
  }
`

const Subtitle = styled.p`
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  @media (max-width: 768px) {
    font-size: var(--font-size-xs);
  }
`

const CountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  
  @media (max-width: 768px) {
    font-size: 11px;
  }
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
`

export default function SectionHeader({
  title,
  subtitle,
  count,
  showBackButton = false,
  onBack,
  backIcon,
  icon,
  actions,
  className = '',
  compact = false
}: SectionHeaderProps) {
  const displayCount = typeof count === 'number' ? `${count}` : count
  const hasSubtitle = subtitle || displayCount

  return (
    <HeaderContainer className={className} $compact={compact}>
      <HeaderLeft>
        {showBackButton && (
          <BackButton
            onClick={onBack}
            aria-label="返回"
            title="返回"
          >
            {backIcon || <ChevronLeft size={20} />}
          </BackButton>
        )}

        {icon && (
          <TitleIcon>
            {icon}
          </TitleIcon>
        )}

        <TitleContent>
          <Title>{title}</Title>
          {hasSubtitle && (
            <Subtitle>
              {subtitle && !displayCount && subtitle}
              {subtitle && displayCount && `${subtitle} · `}
              {displayCount && typeof count === 'number' ? (
                <CountBadge>{displayCount}</CountBadge>
              ) : (
                displayCount
              )}
            </Subtitle>
          )}
        </TitleContent>
      </HeaderLeft>

      {actions && (
        <HeaderActions>
          {actions}
        </HeaderActions>
      )}
    </HeaderContainer>
  )
}