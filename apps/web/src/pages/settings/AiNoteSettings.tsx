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
  X,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  Check
} from 'lucide-react'
import { useToast } from '../../components/Toast'

interface LLMProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
  isDefault?: boolean
  isCustom?: boolean
}

interface NoteStyle {
  value: string
  label: string
  description: string
  prompt?: string
}

interface AiNoteSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

const STORAGE_KEY_PROVIDERS = 'pilinote_llm_providers'
const STORAGE_KEY_STYLES = 'pilinote_custom_styles'

const DEFAULT_PROVIDERS: LLMProvider[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], isDefault: true },
  { id: 'claude', name: 'Claude', baseUrl: 'https://api.anthropic.com', apiKey: '', models: ['claude-sonnet-4-20250614', 'claude-opus-4-20250514', 'claude-haiku-3-20250620'], isDefault: true },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', models: ['deepseek-chat', 'deepseek-coder'], isDefault: true },
  { id: 'qwen', name: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: '', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], isDefault: true },
]

const DEFAULT_STYLES: NoteStyle[] = [
  { value: 'minimal', label: '精简', description: '仅记录最重要的内容', prompt: '请简洁总结视频要点' },
  { value: 'detailed', label: '详细', description: '包含完整内容和详细讨论', prompt: '请详细总结视频内容' },
  { value: 'academic', label: '学术', description: '正式结构化，适合学术报告', prompt: '请以学术风格总结' },
  { value: 'tutorial', label: '教程', description: '详细记录关键点和结论', prompt: '请以教程风格总结关键点' },
  { value: 'xiaohongshu', label: '小红书', description: '爆款标题、emoji表达', prompt: '请以小红书风格总结' },
  { value: 'life_journal', label: '生活向', description: '情感化表达，记录生活感悟', prompt: '请以生活感悟风格总结' },
  { value: 'task_oriented', label: '任务导向', description: '强调任务和目标', prompt: '请以任务导向风格总结' },
  { value: 'business', label: '商业风格', description: '正式精准，适合商业报告', prompt: '请以商业风格总结' },
  { value: 'meeting_minutes', label: '会议纪要', description: '突出决策和行动项', prompt: '请以会议纪要格式总结' },
]

const AiNoteSettings = forwardRef<AiNoteSettingsRef>((_props, ref) => {
  const { settings, updateSettings } = useSettingsStore()
  const { showToast } = useToast()
  
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({
    llm: {},
    style: {},
    format: {}
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // 服务商列表
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [activeProviderId, setActiveProviderId] = useState('openai')
  const [showProviderEditor, setShowProviderEditor] = useState(false)
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null)
  const [providerForm, setProviderForm] = useState({ name: '', baseUrl: '', apiKey: '', models: '' })
  
  // 风格列表
  const [customStyles, setCustomStyles] = useState<NoteStyle[]>([])
  const [activeStyleId, setActiveStyleId] = useState('detailed')
  const [showStyleEditor, setShowStyleEditor] = useState(false)
  const [editingStyle, setEditingStyle] = useState<NoteStyle | null>(null)
  const [styleForm, setStyleForm] = useState({ label: '', description: '', prompt: '' })

  // 加载数据
  useEffect(() => {
    try {
      const savedProviders = localStorage.getItem(STORAGE_KEY_PROVIDERS)
      setProviders(savedProviders ? JSON.parse(savedProviders) : DEFAULT_PROVIDERS)
      
      const savedStyles = localStorage.getItem(STORAGE_KEY_STYLES)
      setCustomStyles(savedStyles ? JSON.parse(savedStyles) : [])
    } catch (e) {
      setProviders(DEFAULT_PROVIDERS)
    }
  }, [])

  // 保存服务商
  const saveProviders = (newProviders: LLMProvider[]) => {
    setProviders(newProviders)
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(newProviders))
  }

  // 添加/编辑服务商
  const handleAddProvider = () => {
    setEditingProvider(null)
    setProviderForm({ name: '', baseUrl: '', apiKey: '', models: '' })
    setShowProviderEditor(true)
  }

  const handleEditProvider = (p: LLMProvider) => {
    setEditingProvider(p)
    setProviderForm({ name: p.name, baseUrl: p.baseUrl, apiKey: p.apiKey, models: p.models.join(', ') })
    setShowProviderEditor(true)
  }

  const handleDeleteProvider = (id: string) => {
    const newProviders = providers.filter(p => p.id !== id)
    saveProviders(newProviders)
    if (activeProviderId === id) setActiveProviderId(providers[0]?.id || 'openai')
    showToast('已删除', 'success')
  }

  const handleSaveProvider = () => {
    if (!providerForm.name.trim()) {
      showToast('请输入服务商名称', 'error')
      return
    }
    
    const id = editingProvider?.id || `custom_${Date.now()}`
    const newProvider: LLMProvider = {
      id,
      name: providerForm.name.trim(),
      baseUrl: providerForm.baseUrl.trim(),
      apiKey: providerForm.apiKey,
      models: providerForm.models.split(',').map(m => m.trim()).filter(Boolean),
      isCustom: true
    }
    
    let newProviders: LLMProvider[]
    if (editingProvider) {
      newProviders = providers.map(p => p.id === editingProvider.id ? newProvider : p)
    } else {
      newProviders = [...providers, newProvider]
    }
    
    saveProviders(newProviders)
    setShowProviderEditor(false)
    setEditingProvider(null)
    setProviderForm({ name: '', baseUrl: '', apiKey: '', models: '' })
    showToast(editingProvider ? '已更新' : '已添加', 'success')
  }

  const handleResetProvider = (id: string) => {
    const defaultP = DEFAULT_PROVIDERS.find(p => p.id === id)
    if (defaultP) {
      const newProviders = providers.map(p => p.id === id ? { ...p, baseUrl: defaultP.baseUrl, models: defaultP.models } : p)
      saveProviders(newProviders)
      showToast('已重置', 'success')
    }
  }

  // 风格管理
  const handleAddStyle = () => {
    setEditingStyle(null)
    setStyleForm({ label: '', description: '', prompt: '' })
    setShowStyleEditor(true)
  }

  const handleEditStyle = (s: NoteStyle) => {
    setEditingStyle(s)
    setStyleForm({ label: s.label, description: s.description, prompt: s.prompt || '' })
    setShowStyleEditor(true)
  }

  const handleDeleteStyle = (value: string) => {
    const newStyles = customStyles.filter(s => s.value !== value)
    setCustomStyles(newStyles)
    localStorage.setItem(STORAGE_KEY_STYLES, JSON.stringify(newStyles))
    showToast('已删除', 'success')
  }

  const handleSaveStyle = () => {
    if (!styleForm.label.trim()) {
      showToast('请输入风格名称', 'error')
      return
    }
    
    const value = editingStyle?.value || `custom_${Date.now()}`
    const newStyle: NoteStyle = {
      value,
      label: styleForm.label.trim(),
      description: styleForm.description.trim(),
      prompt: styleForm.prompt.trim()
    }
    
    let newStyles: NoteStyle[]
    if (editingStyle) {
      newStyles = customStyles.map(s => s.value === editingStyle.value ? newStyle : s)
    } else {
      newStyles = [...customStyles, newStyle]
    }
    
    setCustomStyles(newStyles)
    localStorage.setItem(STORAGE_KEY_STYLES, JSON.stringify(newStyles))
    setShowStyleEditor(false)
    setEditingStyle(null)
    setStyleForm({ label: '', description: '', prompt: '' })
    showToast(editingStyle ? '已更新' : '已添加', 'success')
  }

  const currentProvider = providers.find(p => p.id === activeProviderId)
  const allStyles = [...DEFAULT_STYLES, ...customStyles]

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => Object.keys(localSettings.llm || {}).length > 0,
    saveSettings: async () => {
      if (!Object.keys(localSettings.llm || {}).length) {
        setSavedStatus('idle')
        return
      }
      setSavedStatus('saving')
      try {
        const currentAiNote = settings?.ai_note || { llm: { provider: 'openai', model: 'gpt-4o-mini', api_key: '', temperature: 0.7 } }
        await updateSettings({ ai_note: { ...currentAiNote, llm: { ...currentAiNote.llm, ...localSettings.llm } } })
        setSavedStatus('saved')
        setLocalSettings({ llm: {}, style: {}, format: {} })
        setTimeout(() => setSavedStatus('idle'), 2000)
      } catch (error) {
        setSavedStatus('error')
        throw error
      }
    },
    getSavedStatus: () => savedStatus
  }))

  const updateLocal = (category: string, key: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], [key]: value }
    }))
  }

  return (
    <div className="settings-section">
      {/* 服务商管理 */}
      <div className="settings-group">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Brain size={18} />
            AI 服务商
          </h3>
          <button className="settings-add-btn" onClick={handleAddProvider}>
            <Plus size={16} />
            新建
          </button>
        </div>
        
        {/* 服务商Tabs */}
        <div className="settings-provider-tabs">
          {providers.map(p => (
            <button
              key={p.id}
              className={`settings-provider-tab ${activeProviderId === p.id ? 'active' : ''}`}
              onClick={() => setActiveProviderId(p.id)}
            >
              {p.name}
              {p.isCustom && <span className="settings-tag">自定义</span>}
            </button>
          ))}
        </div>
        
        {/* 服务商配置 */}
        {currentProvider && (
          <div className="settings-provider-config">
            <div className="settings-provider-header">
              <span className="settings-provider-name">{currentProvider.name}</span>
              <div className="settings-provider-actions">
                {currentProvider.isDefault && (
                  <button onClick={() => handleResetProvider(currentProvider.id)} title="重置">
                    <RotateCcw size={14} />
                  </button>
                )}
                <button onClick={() => handleEditProvider(currentProvider)} title="编辑">
                  <Edit2 size={14} />
                </button>
                {currentProvider.isCustom && (
                  <button onClick={() => handleDeleteProvider(currentProvider.id)} title="删除">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="settings-item">
              <label className="settings-label">Base URL</label>
              <input
                type="text"
                className="settings-input"
                placeholder="API地址"
                value={currentProvider.baseUrl}
                readOnly
              />
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
                value={currentProvider.apiKey}
                readOnly
              />
            </div>
            
            <div className="settings-item">
              <label className="settings-label">模型列表</label>
              <div className="settings-model-tags">
                {currentProvider.models.map(m => (
                  <span key={m} className="settings-model-tag">{m}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 风格预设 */}
      <div className="settings-group">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Sparkles size={18} />
            笔记风格
          </h3>
          <button className="settings-add-btn" onClick={handleAddStyle}>
            <Plus size={16} />
            新建
          </button>
        </div>
        
        <div className="settings-style-grid">
          {allStyles.map(s => (
            <div 
              key={s.value} 
              className={`settings-style-card ${activeStyleId === s.value ? 'active' : ''}`}
              onClick={() => setActiveStyleId(s.value)}
            >
              <div className="settings-style-card-header">
                <span className="settings-style-card-label">{s.label}</span>
                {activeStyleId === s.value && <Check size={14} className="settings-check" />}
              </div>
              <p className="settings-style-card-desc">{s.description}</p>
              <div className="settings-style-card-actions">
                <button onClick={(e) => { e.stopPropagation(); handleEditStyle(s); }}>
                  <Edit2 size={12} />
                </button>
                {s.value.startsWith('custom_') && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteStyle(s.value); }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LLM使用设置 */}
      <div className="settings-group">
        <h3 className="settings-group-title">
          <Key size={18} />
          当前使用
        </h3>
        
        <div className="settings-item">
          <label className="settings-label">选择服务商</label>
          <select
            className="settings-select"
            value={localSettings.llm?.provider || activeProviderId}
            onChange={(e) => updateLocal('llm', 'provider', e.target.value)}
          >
            {providers.map(p => (
              <option key={p.value} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        
        <div className="settings-item">
          <label className="settings-label">选择模型</label>
          <select
            className="settings-select"
            value={localSettings.llm?.model || ''}
            onChange={(e) => updateLocal('llm', 'model', e.target.value)}
          >
            {(providers.find(p => p.id === (localSettings.llm?.provider || activeProviderId))?.models || []).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
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
              value={localSettings.llm?.temperature ?? 0.7}
              onChange={(e) => updateLocal('llm', 'temperature', parseFloat(e.target.value))}
            />
            <span className="settings-range-value">{localSettings.llm?.temperature ?? 0.7}</span>
          </div>
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
              checked={localSettings.auto_analyze ?? false}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, auto_analyze: e.target.checked }))}
            />
            下载完成后自动生成AI笔记
          </label>
        </div>
      </div>

      {/* 服务商编辑器 */}
      {showProviderEditor && (
        <div className="settings-modal-overlay" onClick={() => setShowProviderEditor(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h4>{editingProvider ? '编辑服务商' : '新建服务商'}</h4>
              <button onClick={() => setShowProviderEditor(false)}><X size={20} /></button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-item">
                <label className="settings-label">服务商名称</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="如：OpenAI"
                  value={providerForm.name}
                  onChange={(e) => setProviderForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="settings-item">
                <label className="settings-label">Base URL</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="https://api.xxx.com/v1"
                  value={providerForm.baseUrl}
                  onChange={(e) => setProviderForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                />
              </div>
              <div className="settings-item">
                <label className="settings-label">API Key</label>
                <input
                  type="password"
                  className="settings-input"
                  placeholder="sk-xxx"
                  value={providerForm.apiKey}
                  onChange={(e) => setProviderForm(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>
              <div className="settings-item">
                <label className="settings-label">模型列表（逗号分隔）</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="gpt-4o, gpt-4o-mini"
                  value={providerForm.models}
                  onChange={(e) => setProviderForm(prev => ({ ...prev, models: e.target.value }))}
                />
              </div>
            </div>
            <div className="settings-modal-footer">
              <button className="settings-btn-secondary" onClick={() => setShowProviderEditor(false)}>取消</button>
              <button className="settings-btn-primary" onClick={handleSaveProvider}>
                <Save size={16} />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 风格编辑器 */}
      {showStyleEditor && (
        <div className="settings-modal-overlay" onClick={() => setShowStyleEditor(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h4>{editingStyle ? '编辑风格' : '新建风格'}</h4>
              <button onClick={() => setShowStyleEditor(false)}><X size={20} /></button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-item">
                <label className="settings-label">风格名称</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="如：教程风"
                  value={styleForm.label}
                  onChange={(e) => setStyleForm(prev => ({ ...prev, label: e.target.value }))}
                />
              </div>
              <div className="settings-item">
                <label className="settings-label">描述</label>
                <textarea
                  className="settings-textarea"
                  placeholder="描述这个风格的特点"
                  value={styleForm.description}
                  onChange={(e) => setStyleForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="settings-item">
                <label className="settings-label">Prompt提示词</label>
                <textarea
                  className="settings-textarea"
                  placeholder="AI生成笔记时使用的提示词模板"
                  value={styleForm.prompt}
                  onChange={(e) => setStyleForm(prev => ({ ...prev, prompt: e.target.value }))}
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
          margin-bottom: 28px;
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

        /* Provider Tabs */
        .settings-provider-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--color-bg-secondary);
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .settings-provider-tab {
          flex: 1;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .settings-provider-tab.active {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .settings-tag {
          font-size: 9px;
          padding: 2px 5px;
          background: var(--color-primary-600);
          color: white;
          border-radius: 4px;
        }

        .settings-provider-config {
          padding: 16px;
          background: var(--color-bg-secondary);
          border-radius: 12px;
        }

        .settings-provider-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .settings-provider-name {
          font-size: 15px;
          font-weight: 600;
        }

        .settings-provider-actions {
          display: flex;
          gap: 4px;
        }

        .settings-provider-actions button {
          padding: 6px;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          border-radius: 6px;
        }

        .settings-provider-actions button:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        .settings-model-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .settings-model-tag {
          padding: 4px 10px;
          background: var(--color-bg-tertiary);
          border-radius: 6px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        /* Style Grid */
        .settings-style-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .settings-style-card {
          padding: 14px;
          background: var(--color-bg-secondary);
          border-radius: 12px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
        }

        .settings-style-card:hover {
          border-color: var(--color-primary-300);
        }

        .settings-style-card.active {
          border-color: var(--color-primary-600);
          background: var(--color-primary-50);
        }

        .settings-style-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .settings-style-card-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .settings-check {
          color: var(--color-primary-600);
        }

        .settings-style-card-desc {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin-top: 4px;
        }

        .settings-style-card-actions {
          display: flex;
          gap: 4px;
          margin-top: 8px;
        }

        .settings-style-card-actions button {
          padding: 4px;
          border: none;
          background: transparent;
          color: var(--color-text-tertiary);
          cursor: pointer;
        }

        .settings-style-card-actions button:hover {
          color: var(--color-text-primary);
        }

        /* Form Elements */
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
          background: var(--color-bg-tertiary);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          color: var(--color-text-primary);
        }

        .settings-textarea {
          min-height: 80px;
          resize: vertical;
        }

        .settings-range {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .settings-range-value {
          min-width: 40px;
          text-align: right;
        }

        .settings-checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .settings-checkbox-label input {
          width: 18px;
          height: 18px;
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
          max-width: 420px;
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
        }

        .settings-modal-header button {
          padding: 4px;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
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
          cursor: pointer;
        }

        .settings-btn-primary {
          background: var(--color-primary-600);
          color: white;
        }

        .settings-btn-secondary {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }
      `}</style>
    </div>
  )
})

export default AiNoteSettings