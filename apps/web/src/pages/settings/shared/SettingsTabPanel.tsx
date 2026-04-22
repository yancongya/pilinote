import { useEffect, useState, type ReactNode } from 'react'

type SettingsTabPanelProps = {
  children: ReactNode
  className?: string
  direction?: 'forward' | 'backward'
  tabId: string
}

export function SettingsTabPanel({ children, className = '', direction = 'forward', tabId }: SettingsTabPanelProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setIsVisible(true)
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [tabId])

  return (
    <div
      className={`settings-tab-panel${isVisible ? ' is-visible' : ''} ${className}`.trim()}
      data-direction={direction}
      data-tab-panel={tabId}
    >
      {children}
    </div>
  )
}
