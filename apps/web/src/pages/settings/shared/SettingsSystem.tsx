import type { ReactNode } from 'react'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import './settings-system.css'

type PageShellProps = {
  header: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function SettingsPageShell({ header, children, footer }: PageShellProps) {
  return (
    <main className="settings-page-shell">
      {header}
      <div className="settings-page-content">
        {children}
      </div>
      {footer ? <div className="settings-page-footer">{footer}</div> : null}
    </main>
  )
}

type SettingsSectionProps = {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  compact?: boolean
}

export function SettingsSection({
  title,
  subtitle,
  actions,
  children,
  compact = false,
}: SettingsSectionProps) {
  return (
    <section className={`settings-section${compact ? ' is-compact' : ''}`}>
      {(title || subtitle || actions) && (
        <header className="settings-section-header">
          <div className="settings-section-heading">
            {title ? <h2 className="settings-section-title">{title}</h2> : null}
            {subtitle ? <p className="settings-section-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="settings-section-actions">{actions}</div> : null}
        </header>
      )}
      <div className="settings-section-body">{children}</div>
    </section>
  )
}

type SettingsFieldProps = {
  label: string
  hint?: string
  hintInline?: boolean
  icon?: ReactNode
  children: ReactNode
  align?: 'stacked' | 'inline'
}

export function SettingsField({
  label,
  hint,
  hintInline,
  icon,
  children,
  align = 'stacked',
}: SettingsFieldProps) {
  return (
    <div className={`settings-field ${align === 'inline' ? 'is-inline' : 'is-stacked'}`}>
      <div className="settings-field-label-row">
        <div className="settings-field-label-wrap">
          {icon ? <span className="settings-field-icon">{icon}</span> : null}
          <span className="settings-field-label">{label}</span>
        </div>
        {hint && hintInline ? (
          <span className="settings-field-hint-icon" title={hint}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </span>
        ) : null}
      </div>
      <div className="settings-field-control">{children}</div>
      {hint && !hintInline ? <p className="settings-field-hint">{hint}</p> : null}
    </div>
  )
}

type SettingsToggleRowProps = {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function SettingsToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: SettingsToggleRowProps) {
  return (
    <label className="settings-toggle-row">
      <div className="settings-toggle-row-copy">
        <span className="settings-toggle-row-label">{label}</span>
        {hint ? <span className="settings-toggle-row-hint">{hint}</span> : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="settings-toggle-row-input"
      />
    </label>
  )
}

type SettingsActionRowProps = {
  children: ReactNode
  dangerZone?: boolean
}

export function SettingsActionRow({ children, dangerZone = false }: SettingsActionRowProps) {
  return (
    <div className={`settings-action-row${dangerZone ? ' is-danger-zone' : ''}`}>
      {children}
    </div>
  )
}

type SettingsStatusBadgeProps = {
  state: 'idle' | 'saving' | 'saved' | 'error' | 'warning'
  children: ReactNode
}

export function SettingsStatusBadge({ state, children }: SettingsStatusBadgeProps) {
  const icon = (() => {
    switch (state) {
      case 'saving':
        return <Loader2 size={14} className="settings-status-icon is-spinning" />
      case 'saved':
        return <Check size={14} className="settings-status-icon" />
      case 'warning':
      case 'error':
        return <TriangleAlert size={14} className="settings-status-icon" />
      default:
        return null
    }
  })()

  return (
    <span className={`settings-status-badge state-${state}`}>
      {icon}
      <span>{children}</span>
    </span>
  )
}

export function SettingsLoadingState({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="settings-state settings-state-loading" role="status" aria-live="polite">
      <Loader2 className="settings-state-spinner is-spinning" />
      <p>{label}</p>
    </div>
  )
}

type SettingsEmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function SettingsEmptyState({
  title,
  description,
  icon,
  action,
}: SettingsEmptyStateProps) {
  return (
    <div className="settings-state settings-state-empty">
      {icon ? <div className="settings-state-icon">{icon}</div> : null}
      <p className="settings-state-title">{title}</p>
      {description ? <p className="settings-state-description">{description}</p> : null}
      {action ? <div className="settings-state-action">{action}</div> : null}
    </div>
  )
}

