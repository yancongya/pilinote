import { useState, forwardRef, useImperativeHandle } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { 
  Brain, 
  Key, 
  Thermometer, 
  FileText, 
  Clock, 
  Sparkles
} from 'lucide-react'

interface AiNoteSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const AiNoteSettings = forwardRef<AiNoteSettingsRef>((_props, ref) => {
  const { settings, updateSettings } = useSettingsStore()
  
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({
    llm: {},
    style: {},
    format: {}
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const currentAiNote = settings?.ai_note || {
    llm: { provider: 'openai', model: 'gpt-4o-mini', api_key: '', temperature: 0.7 },
    style: { style: 'concise', length: 500 },
    format: { format: 'markdown', include_timestamp: true, include_summary: true },
    auto_analyze: false
  }

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => {
      return Object.keys(localSettings.llm || {}).length > 0 ||
             Object.keys(localSettings.style || {}).length > 0 ||
             Object.keys(localSettings.format || {}).length > 0 ||
             'auto_analyze' in localSettings
    },
    saveSettings: async () => {
      const hasChanges = Object.keys(localSettings.llm || {}).length > 0 ||
                       Object.keys(localSettings.style || {}).length > 0 ||
                       Object.keys(localSettings.format || {}).length > 0 ||
                       'auto_analyze' in localSettings
      
      if (!hasChanges) {
        setSavedStatus('idle')
        return
      }

      setSavedStatus('saving')

      try {
        const mergedSettings = {
          llm: { ...currentAiNote.llm, ...(localSettings.llm || {}) },
          style: { ...currentAiNote.style, ...(localSettings.style || {}) },
          format: { ...currentAiNote.format, ...(localSettings.format || {}) },
          auto_analyze: localSettings.auto_analyze !== undefined 
            ? localSettings.auto_analyze 
            : currentAiNote.auto_analyze
        }

        await updateSettings({
          ai_note: mergedSettings
        })
        
        setSavedStatus('saved')
        setLocalSettings({ llm: {}, style: {}, format: {} })
        
        setTimeout(() => {
          setSavedStatus('idle')
        }, 2000)
      } catch (error) {
        setSavedStatus('error')
        console.error('保存设置失败:', error)
        throw error
      }
    },
    getSavedStatus: () => savedStatus
  }))

  const providers = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'claude', label: 'Claude' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'qwen', label: 'Qwen' }
  ]

  const models = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    claude: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    deepseek: ['deepseek-chat', 'deepseek-coder'],
    qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max']
  }

  const styles = [
    { value: 'concise', label: '简洁' },
    { value: 'detailed', label: '详细' },
    { value: 'bullet', label: '要点' }
  ]

  const formats = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'text', label: '纯文本' },
    { value: 'html', label: 'HTML' }
  ]

  const updateLocal = (category: string, key: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  const getValue = (category: string, key: string, defaultValue?: any) => {
    if (category in localSettings && key in localSettings[category]) {
      return localSettings[category][key]
    }
    return defaultValue
  }

  return (
    <div className="settings-section">
      <div className="settings-group">
        <h3 className="settings-group-title">
          <Brain size={18} />
          LLM 配置
        </h3>

        <div className="settings-item">
          <label className="settings-label">提供商</label>
          <select
            className="settings-select"
            value={getValue('llm', 'provider') || currentAiNote.llm.provider}
            onChange={(e) => updateLocal('llm', 'provider', e.target.value)}
          >
            {providers.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-item">
          <label className="settings-label">模型</label>
          <select
            className="settings-select"
            value={getValue('llm', 'model') || currentAiNote.llm.model}
            onChange={(e) => updateLocal('llm', 'model', e.target.value)}
          >
            {(models[getValue('llm', 'provider') as keyof typeof models || currentAiNote.llm.provider] || []).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="settings-item">
          <label className="settings-label">
            <Key size={14} />
            API Key
          </label>
          <input
            type="password"
            className="settings-input"
            placeholder="留空使用环境变量"
            value={getValue('llm', 'api_key') || currentAiNote.llm.api_key || ''}
            onChange={(e) => updateLocal('llm', 'api_key', e.target.value)}
          />
          <span className="settings-hint">留空将使用环境变量中的 API Key</span>
        </div>

        <div className="settings-item">
          <label className="settings-label">
            <Thermometer size={14} />
            温度
          </label>
          <div className="settings-range">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={getValue('llm', 'temperature') ?? currentAiNote.llm.temperature ?? 0.7}
              onChange={(e) => updateLocal('llm', 'temperature', parseFloat(e.target.value))}
            />
            <span className="settings-range-value">
              {getValue('llm', 'temperature') ?? currentAiNote.llm.temperature ?? 0.7}
            </span>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">
          <FileText size={18} />
          笔记风格
        </h3>

        <div className="settings-item">
          <label className="settings-label">风格</label>
          <select
            className="settings-select"
            value={getValue('style', 'style') || currentAiNote.style.style}
            onChange={(e) => updateLocal('style', 'style', e.target.value)}
          >
            {styles.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-item">
          <label className="settings-label">
            <Clock size={14} />
            目标长度
          </label>
          <input
            type="number"
            className="settings-input"
            min="100"
            max="2000"
            value={getValue('style', 'length') || currentAiNote.style.length || 500}
            onChange={(e) => updateLocal('style', 'length', parseInt(e.target.value))}
          />
          <span className="settings-hint">字符数</span>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">
          <FileText size={18} />
          输出格式
        </h3>

        <div className="settings-item">
          <label className="settings-label">格式</label>
          <select
            className="settings-select"
            value={getValue('format', 'format') || currentAiNote.format.format}
            onChange={(e) => updateLocal('format', 'format', e.target.value)}
          >
            {formats.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-item">
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={getValue('format', 'include_timestamp') ?? currentAiNote.format.include_timestamp ?? true}
              onChange={(e) => updateLocal('format', 'include_timestamp', e.target.checked)}
            />
            包含时间戳
          </label>
        </div>

        <div className="settings-item">
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={getValue('format', 'include_summary') ?? currentAiNote.format.include_summary ?? true}
              onChange={(e) => updateLocal('format', 'include_summary', e.target.checked)}
            />
            包含总结
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">
          <Sparkles size={18} />
          自动功能
        </h3>

        <div className="settings-item">
          <label className="settings-checkbox-label">
            <input
              type="checkbox"
              checked={'auto_analyze' in localSettings 
                ? localSettings.auto_analyze 
                : currentAiNote.auto_analyze ?? false}
              onChange={(e) => setLocalSettings(prev => ({ 
                ...prev, 
                auto_analyze: e.target.checked 
              }))}
            />
            自动分析已下载视频
          </label>
          <span className="settings-hint">下载完成后自动生成AI笔记</span>
        </div>
      </div>

      <style>{`
        .settings-section {
          padding: 16px;
          padding-bottom: 80px;
        }

        .settings-group {
          margin-bottom: 24px;
        }

        .settings-group-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-primary);
          margin: 0 0 16px;
        }

        .settings-item {
          margin-bottom: 16px;
        }

        .settings-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: var(--color-text-secondary);
          margin-bottom: 8px;
        }

        .settings-input,
        .settings-select {
          width: 100%;
          padding: 10px 12px;
          font-size: 14px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          color: var(--color-text-primary);
        }

        .settings-input:focus,
        .settings-select:focus {
          outline: none;
          border-color: var(--color-primary-600);
        }

        .settings-hint {
          display: block;
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin-top: 4px;
        }

        .settings-range {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .settings-range input[type="range"] {
          flex: 1;
        }

        .settings-range-value {
          min-width: 40px;
          text-align: right;
          font-size: 14px;
          color: var(--color-text-primary);
        }

        .settings-checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--color-text-primary);
          cursor: pointer;
        }

        .settings-checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--color-primary-600);
        }
      `}</style>
    </div>
  )
})

export default AiNoteSettings