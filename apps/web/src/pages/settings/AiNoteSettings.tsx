import { useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { NOTE_STYLES, NOTE_FORMATS } from '../../services/aiNote'
import { 
  Brain, 
  Key, 
  Thermometer, 
  FileText, 
  Clock, 
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Save,
  X
} from 'lucide-react'
import { useToast } from '../../components/Toast'

interface AiNoteSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

interface CustomStyle {
  value: string
  label: string
  description: string
}

const STORAGE_KEY = 'pilinote_custom_styles'

const AiNoteSettings = forwardRef<AiNoteSettingsRef>((_props, ref) => {
  const { settings, updateSettings } = useSettingsStore()
  const { showToast } = useToast()
  
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({
    llm: {},
    style: {},
    format: {}
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // 从localStorage加载自定义风格
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([])
  const [showStyleEditor, setShowStyleEditor] = useState(false)
  const [editingStyle, setEditingStyle] = useState<CustomStyle | null>(null)
  const [editForm, setEditForm] = useState({ label: '', description: '' })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setCustomStyles(JSON.parse(saved))
      }
    } catch (e) {}
  }, [])

  const saveCustomStyles = (styles: CustomStyle[]) => {
    setCustomStyles(styles)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(styles))
  }

  const handleAddStyle = () => {
    setEditingStyle({ value: '', label: '', description: '' })
    setEditForm({ label: '', description: '' })
    setShowStyleEditor(true)
  }

  const handleEditStyle = (style: CustomStyle) => {
    setEditingStyle(style)
    setEditForm({ label: style.label, description: style.description })
    setShowStyleEditor(true)
  }

  const handleDeleteStyle = (value: string) => {
    const newStyles = customStyles.filter(s => s.value !== value)
    saveCustomStyles(newStyles)
    showToast('已删除', 'success')
  }

  const handleSaveStyle = () => {
    if (!editForm.label.trim()) {
      showToast('请输入风格名称', 'error')
      return
    }
    
    const value = editingStyle?.value || `custom_${Date.now()}`
    const newStyle: CustomStyle = {
      value,
      label: editForm.label.trim(),
      description: editForm.description.trim()
    }
    
    let newStyles: CustomStyle[]
    if (editingStyle) {
      newStyles = customStyles.map(s => s.value === editingStyle.value ? newStyle : s)
    } else {
      newStyles = [...customStyles, newStyle]
    }
    
    saveCustomStyles(newStyles)
    setShowStyleEditor(false)
    setEditingStyle(null)
    setEditForm({ label: '', description: '' })
    showToast(editingStyle ? '已更新' : '已添加', 'success')
  }

  const currentAiNote = settings?.ai_note || {
    llm: { provider: 'openai', model: 'gpt-4o-mini', api_key: '', temperature: 0.7 },
    style: { style: 'concise', length: 500 },
    format: { format: 'markdown', include_timestamp: true, include_summary: true },
    auto_analyze: false
  }

  // 所有风格
  const allStyles = [
    ...NOTE_STYLES.map(s => ({ value: s.value, label: s.label, description: s.description, isCustom: false })),
    ...customStyles.map(s => ({ ...s, isCustom: true }))
  ]

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

  const models: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    claude: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    deepseek: ['deepseek-chat', 'deepseek-coder'],
    qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max']
  }

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
      {/* 风格管理 */}
      <div className="settings-group">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Sparkles size={18} />
            笔记风格
          </h3>
          <button className="settings-add-btn" onClick={handleAddStyle}>
            <Plus size={16} />
            添加风格
          </button>
        </div>
        
        <div className="settings-style-list">
          {allStyles.map(s => (
            <div key={s.value} className="settings-style-item">
              <div className="settings-style-info">
                <span className="settings-style-label">
                  {s.label}
                  {s.isCustom && <span className="settings-style-tag">自定义</span>}
                </span>
                <span className="settings-style-desc">{s.description}</span>
              </div>
              {s.isCustom && (
                <div className="settings-style-actions">
                  <button onClick={() => handleEditStyle(s)}><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteStyle(s.value)}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* LLM配置 */}
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

      {/* 格式设置 */}
      <div className="settings-group">
        <h3 className="settings-group-title">
          <FileText size={18} />
          输出格式
        </h3>

        <div className="settings-item">
          <label className="settings-label">默认格式</label>
          <select
            className="settings-select"
            value={getValue('format', 'format') || currentAiNote.format.format || 'markdown'}
            onChange={(e) => updateLocal('format', 'format', e.target.value)}
          >
            {NOTE_FORMATS.map(f => (
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
            AI 总结
          </label>
        </div>
      </div>

      {/* 自动功能 */}
      <div className="settings-group">
        <h3 className="settings-group-title">
          <Clock size={18} />
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
            下载完成后自动生成AI笔记
          </label>
        </div>
      </div>

      {/* 风格编辑器弹窗 */}
      {showStyleEditor && (
        <div className="settings-modal-overlay" onClick={() => setShowStyleEditor(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h4>{editingStyle?.value ? '编辑风格' : '添加风格'}</h4>
              <button onClick={() => setShowStyleEditor(false)}><X size={20} /></button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-item">
                <label className="settings-label">风格名称</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="如：教程风"
                  value={editForm.label}
                  onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                />
              </div>
              <div className="settings-item">
                <label className="settings-label">描述</label>
                <textarea
                  className="settings-textarea"
                  placeholder="描述这个风格的特点"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="settings-modal-footer">
              <button className="settings-btn-secondary" onClick={() => setShowStyleEditor(false)}>取消</button>
              <button className="settings-btn-primary" onClick={handleSaveStyle}>
                <Save size={16} />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .settings-section {
          padding: 16px;
          padding-bottom: 80px;
        }

        .settings-group {
          margin-bottom: 24px;
        }

        .settings-group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
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

        .settings-group-header .settings-group-title {
          margin: 0;
        }

        .settings-add-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          background: var(--color-primary-600);
          color: white;
          border: none;
          cursor: pointer;
        }

        .settings-style-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .settings-style-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: var(--color-bg-secondary);
          border-radius: 10px;
        }

        .settings-style-info {
          flex: 1;
        }

        .settings-style-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .settings-style-tag {
          font-size: 10px;
          padding: 2px 6px;
          background: var(--color-primary-600);
          color: white;
          border-radius: 4px;
        }

        .settings-style-desc {
          display: block;
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin-top: 2px;
        }

        .settings-style-actions {
          display: flex;
          gap: 4px;
        }

        .settings-style-actions button {
          padding: 6px;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          border-radius: 6px;
        }

        .settings-style-actions button:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
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
        .settings-select,
        .settings-textarea {
          width: 100%;
          padding: 10px 12px;
          font-size: 14px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          color: var(--color-text-primary);
        }

        .settings-textarea {
          min-height: 80px;
          resize: vertical;
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

        /* Modal */
        .settings-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0,0,0,0.6);
        }

        .settings-modal {
          width: 100%;
          max-width: 400px;
          background: var(--color-bg-primary);
          border-radius: 16px;
          overflow: hidden;
        }

        .settings-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
        }

        .settings-modal-header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .settings-modal-header button {
          padding: 4px;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .settings-modal-body {
          padding: 20px;
        }

        .settings-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--color-border);
        }

        .settings-btn-primary,
        .settings-btn-secondary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .settings-btn-primary {
          background: var(--color-primary-600);
          color: white;
          border: none;
        }

        .settings-btn-secondary {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border: none;
        }
      `}</style>
    </div>
  )
})

export default AiNoteSettings