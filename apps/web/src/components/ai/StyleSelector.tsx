import { useMemo } from 'react'
import { buildPromptStyleOptions } from '../../services/promptCatalog'

interface StyleSelectorProps {
  value: string
  onChange: (value: string) => void
  currentTemplates?: Record<string, any>
  defaultTemplates?: Record<string, any>
  customStyles?: Array<{ value: string; label: string; description: string; prompt: string }>
}

export function StyleSelector({
  value,
  onChange,
  currentTemplates = {},
  defaultTemplates = {},
  customStyles = [],
}: StyleSelectorProps) {
  const styles = useMemo(
    () => buildPromptStyleOptions(currentTemplates, defaultTemplates, customStyles),
    [currentTemplates, defaultTemplates, customStyles],
  )

  const currentStyle = styles.find(item => item.value === value)

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">笔记风格</label>
      <div className="grid grid-cols-2 gap-2">
        {styles.map(style => (
          <button
            key={style.value}
            type="button"
            onClick={() => onChange(style.value)}
            className={`p-2 rounded-lg text-sm transition-colors ${
              value === style.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {currentStyle?.description || '点击选择风格'}
      </p>
    </div>
  )
}
