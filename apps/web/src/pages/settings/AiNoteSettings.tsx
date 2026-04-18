import { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { 
  Brain, 
  Key, 
  Clock, 
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  X,
  RotateCcw,
  Check,
  Bot,
  Cpu,
  Cloud,
  Server,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { useToast } from '../../components/Toast'
import AiPromptTemplates from './AiPromptTemplates'
import { LocalAsrModelPanel } from '../../components/ai/LocalAsrModelPanel'

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

const SETTINGS_STYLE_CARDS: NoteStyle[] = [
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

const STORAGE_KEY_PROVIDERS = 'pilinote_llm_providers'
const STORAGE_KEY_STYLES = 'pilinote_custom_styles'

const DEFAULT_PROVIDERS: LLMProvider[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], isDefault: true },
  { id: 'claude', name: 'Claude', baseUrl: 'https://api.anthropic.com', apiKey: '', models: ['claude-sonnet-4-20250614', 'claude-opus-4-20250514', 'claude-haiku-3-20250620'], isDefault: true },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', models: ['deepseek-chat', 'deepseek-coder'], isDefault: true },
  { id: 'qwen', name: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: '', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], isDefault: true },
  { id: 'volcengine', name: '火山引擎', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', apiKey: '', models: ['doubao-seed-1-6', 'doubao-pro-32k', 'doubao-lite-32k'], isDefault: true },
  { id: 'modelscope', name: '魔搭社区', baseUrl: 'https://api.modelscope.cn/v1', apiKey: '', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], isDefault: true },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat'], isDefault: true },
  { id: 'moonshot', name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', apiKey: '', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], isDefault: true },
  { id: 'zhipu', name: '智谱清言', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKey: '', models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'], isDefault: true },
  { id: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', apiKey: '', models: ['abab6.5s-chat', 'abab6.5-chat', 'abab6.5t-chat'], isDefault: true },
  { id: 'baidu', name: '文心一言', baseUrl: 'https://qianfan.baidubce.com/v2', apiKey: '', models: ['ernie-4.0', 'ernie-3.5-128k', 'ernie-lite-8k'], isDefault: true },
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

const providerIconMap: Record<string, ReactElement> = {
  openai: <Bot size={16} />,
  claude: <Brain size={16} />,
  deepseek: <Cpu size={16} />,
  qwen: <Cloud size={16} />,
  ollama: <Server size={16} />,
  volcengine: <Cloud size={16} />,
  modelscope: <Server size={16} />,
  openrouter: <Bot size={16} />,
  moonshot: <Bot size={16} />,
  zhipu: <Cpu size={16} />,
  minimax: <Cloud size={16} />,
  baidu: <Brain size={16} />,
}

const AiNoteSettings = forwardRef<AiNoteSettingsRef>((_props, ref) => {
  const { settings, updateSettings, fetchSettings } = useSettingsStore()
  const { showToast } = useToast()
  
  const [localSettings, setLocalSettings] = useState({
    llm: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      api_key: '',
      temperature: 0.7,
    },
    style: {
      style: 'detailed',
      length: 500,
    },
    format: {
      format: 'markdown',
      include_timestamp: true,
      include_summary: true,
    },
    auto_analyze: false,
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // 服务商列表
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [activeProviderId, setActiveProviderId] = useState('openai')
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null)
  const [providerForm, setProviderForm] = useState({ name: '', baseUrl: '', apiKey: '', models: '' })
  const [showApiKey, setShowApiKey] = useState(false)
  
  // 风格列表
  const [customStyles, setCustomStyles] = useState<NoteStyle[]>([])
  const [activeStyleId, setActiveStyleId] = useState('detailed')
  const [editingStyle, setEditingStyle] = useState<NoteStyle | null>(null)
  const [styleForm, setStyleForm] = useState({ label: '', description: '', prompt: '' })
  const [showStyleModal, setShowStyleModal] = useState(false)
  const [showPromptTemplatesModal, setShowPromptTemplatesModal] = useState(false)
  const [modelEditIndex, setModelEditIndex] = useState<number | null>(null)
  const [modelDraft, setModelDraft] = useState('')
  const [modelTestStatus, setModelTestStatus] = useState<Record<string, boolean | 'loading'>>({})
  const [testedModels, setTestedModels] = useState<Record<string, string[]>>({})
  const providerTabsRef = useRef<HTMLDivElement | null>(null)
  const providerBarRef = useRef<HTMLDivElement | null>(null)
  const providerThumbDragState = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
  })
  const [providerScrollState, setProviderScrollState] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  })

  // 加载数据
  useEffect(() => {
    try {
      const savedProviders = localStorage.getItem(STORAGE_KEY_PROVIDERS)
      const parsedProviders: LLMProvider[] = savedProviders ? JSON.parse(savedProviders) : []
      const providerMap = new Map<string, LLMProvider>()

      DEFAULT_PROVIDERS.forEach(provider => {
        providerMap.set(provider.id, provider)
      })
      parsedProviders.forEach(provider => {
        providerMap.set(provider.id, provider)
      })
      setProviders(Array.from(providerMap.values()))
      
      const savedStyles = localStorage.getItem(STORAGE_KEY_STYLES)
      setCustomStyles(savedStyles ? JSON.parse(savedStyles) : [])

      const currentAiNote = settings?.ai_note
      if (currentAiNote) {
          setLocalSettings({
          llm: {
            provider: currentAiNote.llm.provider,
            model: currentAiNote.llm.model,
            api_key: currentAiNote.llm.api_key,
            temperature: currentAiNote.llm.temperature,
          },
          style: {
            style: currentAiNote.style.style,
            length: currentAiNote.style.length,
          },
          format: {
            format: currentAiNote.format.format,
            include_timestamp: currentAiNote.format.include_timestamp,
            include_summary: currentAiNote.format.include_summary,
          },
          auto_analyze: currentAiNote.auto_analyze,
          })
          setTestedModels(currentAiNote.llm.tested_models || {})
          setActiveProviderId(currentAiNote.llm.provider || 'openai')
          setActiveStyleId(currentAiNote.style.style || 'detailed')
        }
    } catch (e) {
      setProviders(DEFAULT_PROVIDERS)
    }
  }, [settings?.ai_note])

  useEffect(() => {
    const container = providerTabsRef.current
    if (!container) return

    const syncScrollState = () => {
      setProviderScrollState({
        scrollLeft: container.scrollLeft,
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
      })
    }

    syncScrollState()
    container.addEventListener('scroll', syncScrollState, { passive: true })

    const resizeObserver = new ResizeObserver(syncScrollState)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', syncScrollState)
      resizeObserver.disconnect()
    }
  }, [providers])

  // 保存服务商
  const saveProviders = (newProviders: LLMProvider[]) => {
    const providerMap = new Map<string, LLMProvider>()

    DEFAULT_PROVIDERS.forEach(provider => {
      providerMap.set(provider.id, provider)
    })
    newProviders.forEach(provider => {
      providerMap.set(provider.id, provider)
    })

    const mergedProviders = Array.from(providerMap.values())
    setProviders(mergedProviders)
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(mergedProviders))
  }

  const resolveStyles = () => {
    const customMap = new Map(customStyles.map(style => [style.value, style]))
    return SETTINGS_STYLE_CARDS.map(style => customMap.get(style.value) || style).concat(
      customStyles.filter(style => !SETTINGS_STYLE_CARDS.some(defaultStyle => defaultStyle.value === style.value))
    )
  }

  // 添加/编辑服务商
  const handleAddProvider = () => {
    const id = `custom_${Date.now()}`
    const newProvider: LLMProvider = {
      id,
      name: '新服务商',
      baseUrl: '',
      apiKey: '',
      models: [],
      isCustom: true,
    }
    const newProviders = [...providers, newProvider]
    saveProviders(newProviders)
    setActiveProviderId(id)
    setEditingProvider(newProvider)
    setProviderForm({ name: newProvider.name, baseUrl: '', apiKey: '', models: '' })
    setShowApiKey(false)
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
    setEditingProvider(null)
    setProviderForm({ name: '', baseUrl: '', apiKey: '', models: '' })
    setShowApiKey(false)
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
    setEditingStyle({ value: `custom_${Date.now()}`, label: '', description: '', prompt: '' })
    setStyleForm({ label: '', description: '', prompt: '' })
    setShowStyleModal(true)
  }

  const handleEditStyle = (s: NoteStyle) => {
    setEditingStyle(s)
    setStyleForm({ label: s.label, description: s.description, prompt: s.prompt || '' })
    setShowStyleModal(true)
  }

  const saveStyles = (newStyles: NoteStyle[]) => {
    setCustomStyles(newStyles)
    localStorage.setItem(STORAGE_KEY_STYLES, JSON.stringify(newStyles))
  }

  const handleDeleteStyle = (value: string) => {
    const newStyles = customStyles.filter(s => s.value !== value)
    saveStyles(newStyles)
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
    
    const existingIndex = customStyles.findIndex(s => s.value === editingStyle?.value)
    let newStyles: NoteStyle[]
    if (editingStyle && existingIndex >= 0) {
      newStyles = customStyles.map(s => s.value === editingStyle.value ? newStyle : s)
    } else if (editingStyle) {
      newStyles = [...customStyles.filter(s => s.value !== editingStyle.value), newStyle]
    } else {
      newStyles = [...customStyles.filter(s => s.value !== newStyle.value), newStyle]
    }
    
    saveStyles(newStyles)
    setEditingStyle(null)
    setStyleForm({ label: '', description: '', prompt: '' })
    setShowStyleModal(false)
    showToast(editingStyle ? '已更新' : '已添加', 'success')
  }

  const currentProvider = providers.find(p => p.id === activeProviderId)
  const allStyles = resolveStyles()

  const beginEditModel = (index: number, currentValue: string) => {
    setModelEditIndex(index)
    setModelDraft(currentValue)
  }

  const commitModel = (providerId: string, index: number, value: string) => {
    const trimmed = value.trim()
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return

    const nextModels = [...provider.models]
    if (!trimmed) {
      nextModels.splice(index, 1)
    } else {
      nextModels[index] = trimmed
    }

    const newProviders = providers.map(p => p.id === providerId ? { ...p, models: nextModels } : p)
    saveProviders(newProviders)
    setModelEditIndex(null)
    setModelDraft('')
  }

  const addModelToProvider = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return
    const nextModels = [...provider.models, `model_${provider.models.length + 1}`]
    const newProviders = providers.map(p => p.id === providerId ? { ...p, models: nextModels } : p)
    saveProviders(newProviders)
    beginEditModel(nextModels.length - 1, nextModels[nextModels.length - 1])
  }

  const testModel = async (providerId: string, modelName: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return
    setModelTestStatus(prev => ({ ...prev, [modelName]: 'loading' }))
    try {
      const response = await fetch('/api/ai/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider.id,
          model: modelName,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || '测试失败')
      }
      setModelTestStatus(prev => ({ ...prev, [modelName]: true }))
      setLocalSettings(prev => ({
        ...prev,
        llm: {
          ...prev.llm,
          provider: provider.id,
          model: modelName,
        },
      }))
      const nextTestedModels = {
        ...testedModels,
        [provider.id]: Array.from(new Set([...(testedModels[provider.id] || []), modelName])),
      }
      setTestedModels(nextTestedModels)
      await updateSettings({
        ai_note: {
          ...(settings?.ai_note || {}),
          llm: {
            ...(settings?.ai_note?.llm || {}),
            provider: provider.id,
            model: modelName,
            api_key: localSettings.llm.api_key,
            temperature: localSettings.llm.temperature,
            tested_models: nextTestedModels,
          },
          style: {
            ...(settings?.ai_note?.style || {}),
            ...localSettings.style,
          },
          format: {
            ...(settings?.ai_note?.format || {}),
            ...localSettings.format,
          },
          auto_analyze: localSettings.auto_analyze,
        },
      })
      await fetchSettings()
      showToast(`模型测试通过: ${modelName}`, 'success')
    } catch (error) {
      setModelTestStatus(prev => ({ ...prev, [modelName]: false }))
      showToast(`测试失败: ${error instanceof Error ? error.message : '无法连接'}`, 'error')
    }
  }

  const providerThumbWidth = useMemo(() => {
    const { scrollWidth, clientWidth } = providerScrollState
    if (!scrollWidth || scrollWidth <= clientWidth) return 0
    return Math.max(28, (clientWidth / scrollWidth) * clientWidth)
  }, [providerScrollState])

  const providerThumbLeft = useMemo(() => {
    const { scrollLeft, scrollWidth, clientWidth } = providerScrollState
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
    const maxThumbLeft = Math.max(0, clientWidth - providerThumbWidth)
    if (!maxScrollLeft || !maxThumbLeft) return 0
    return (scrollLeft / maxScrollLeft) * maxThumbLeft
  }, [providerScrollState, providerThumbWidth])

  const handleProviderBarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = providerTabsRef.current
    const bar = providerBarRef.current
    if (!container || !bar || event.button !== 0) return
    const rect = bar.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const thumbLeft = providerThumbLeft
    const thumbRight = providerThumbLeft + providerThumbWidth
    const withinThumb = clickX >= thumbLeft && clickX <= thumbRight
    providerThumbDragState.current = {
      isDragging: withinThumb,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    }
    if (withinThumb) {
      bar.setPointerCapture(event.pointerId)
      bar.classList.add('dragging')
      return
    }
    const { scrollWidth, clientWidth } = container
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
    const maxThumbLeft = Math.max(1, clientWidth - providerThumbWidth)
    const nextScrollLeft = ((clickX - providerThumbWidth / 2) / maxThumbLeft) * maxScrollLeft
    container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft))
  }

  const handleProviderBarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = providerTabsRef.current
    const bar = providerBarRef.current
    if (!container || !bar || !providerThumbDragState.current.isDragging) return
    const { scrollWidth, clientWidth } = container
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
    const maxThumbLeft = Math.max(1, clientWidth - providerThumbWidth)
    const deltaX = event.clientX - providerThumbDragState.current.startX
    const scrollDelta = (deltaX / maxThumbLeft) * maxScrollLeft
    container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, providerThumbDragState.current.startScrollLeft + scrollDelta))
  }

  const handleProviderBarPointerUp = () => {
    const bar = providerBarRef.current
    if (!bar) return
    providerThumbDragState.current.isDragging = false
    bar.classList.remove('dragging')
  }

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => false,
    saveSettings: async () => {
      try {
        const currentAiNote = settings?.ai_note || {
          llm: { provider: 'openai', model: 'gpt-4o-mini', api_key: '', temperature: 0.7 },
          style: { style: 'detailed', length: 500 },
          format: { format: 'markdown', include_timestamp: true, include_summary: true },
          auto_analyze: false,
        }
        await updateSettings({
          ai_note: {
            ...currentAiNote,
          llm: {
            ...currentAiNote.llm,
            ...localSettings.llm,
            tested_models: testedModels,
          },
            style: {
              ...currentAiNote.style,
              ...localSettings.style,
            },
            format: {
              ...currentAiNote.format,
              ...localSettings.format,
            },
            auto_analyze: localSettings.auto_analyze,
          },
        })
        await fetchSettings()
      setActiveProviderId(localSettings.llm.provider)
      setActiveStyleId(localSettings.style.style)
        setSavedStatus('saved')
        setTimeout(() => setSavedStatus('idle'), 2000)
      } catch (error) {
        setSavedStatus('error')
        throw error
      }
    },
    getSavedStatus: () => savedStatus
  }))

  return (
    <div className="settings-section">
      {/* 服务商管理 */}
      <div className="settings-group">
        <div className="settings-group-header">
          <h3 className="settings-group-title">
            <Brain size={18} />
            AI 服务商
          </h3>
          <div className="settings-group-actions">
            <button className="settings-add-btn settings-secondary-btn" onClick={() => setShowPromptTemplatesModal(true)}>
              <Sparkles size={16} />
              提示词模板
            </button>
            <button className="settings-add-btn" onClick={handleAddProvider}>
              <Plus size={16} />
              新建
            </button>
          </div>
        </div>
        
        {/* 服务商Tabs */}
        <div
          className="settings-provider-tabs"
          ref={providerTabsRef}
        >
          {providers.map(p => (
            <button
              key={p.id}
              className={`settings-provider-tab ${activeProviderId === p.id ? 'active' : ''}`}
              onClick={() => {
                setActiveProviderId(p.id)
                setLocalSettings(prev => ({
                  ...prev,
                  llm: { ...prev.llm, provider: p.id }
                }))
              }}
            >
              <span className="settings-provider-icon">
                {providerIconMap[p.id] || <Key size={16} />}
              </span>
              <span className="settings-provider-name-text">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="settings-provider-bar" ref={providerBarRef} onPointerDown={handleProviderBarPointerDown} onPointerMove={handleProviderBarPointerMove} onPointerUp={handleProviderBarPointerUp} onPointerCancel={handleProviderBarPointerUp}>
          <div
            className={`settings-provider-bar-thumb ${providerScrollState.scrollWidth <= providerScrollState.clientWidth ? 'hidden' : ''}`}
            style={{
              width: `${providerThumbWidth}px`,
              transform: `translateX(${providerThumbLeft}px)`,
            }}
          />
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
                {currentProvider.isCustom && (
                  <button onClick={() => handleDeleteProvider(currentProvider.id)} title="删除">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="settings-provider-edit">
              <div className="settings-item">
                <label className="settings-label">服务商名称</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="如：OpenAI"
                  value={editingProvider?.id === currentProvider.id ? providerForm.name : currentProvider.name}
                  onChange={(e) => {
                    if (editingProvider?.id !== currentProvider.id) return
                    setProviderForm(prev => ({ ...prev, name: e.target.value }))
                  }}
                />
              </div>

              <div className="settings-item">
                <label className="settings-label">Base URL</label>
                <input
                  type="text"
                  className="settings-input"
                  placeholder="API地址"
                  value={editingProvider?.id === currentProvider.id ? providerForm.baseUrl : currentProvider.baseUrl}
                  onChange={(e) => {
                    if (editingProvider?.id !== currentProvider.id) return
                    setProviderForm(prev => ({ ...prev, baseUrl: e.target.value }))
                  }}
                />
              </div>
              
              <div className="settings-item">
                <div className="settings-label-row">
                  <label className="settings-label">
                    <Key size={14} />
                    API Key
                  </label>
                  <button
                    type="button"
                    className="settings-visibility-btn"
                    onClick={() => setShowApiKey(prev => !prev)}
                    title={showApiKey ? '隐藏' : '显示'}
                  >
                    {showApiKey ? '隐藏' : '显示'}
                  </button>
                </div>
                <div className="settings-api-row">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="settings-input"
                    placeholder="留空使用环境变量"
                    value={editingProvider?.id === currentProvider.id ? providerForm.apiKey : currentProvider.apiKey}
                    onChange={(e) => {
                      if (editingProvider?.id !== currentProvider.id) return
                      setProviderForm(prev => ({ ...prev, apiKey: e.target.value }))
                    }}
                  />
                  <button
                    type="button"
                    className="settings-api-test-btn"
                    onClick={() => testModel(currentProvider.id, currentProvider.models[0] || '')}
                    disabled={!currentProvider.models[0]}
                  >
                    测试联通
                  </button>
                </div>
              </div>
              
              {editingProvider?.id === currentProvider.id && (
                <div className="settings-inline-actions">
                  <button className="settings-btn-secondary" onClick={() => { setEditingProvider(null); setProviderForm({ name: '', baseUrl: '', apiKey: '', models: '' }) }}>取消</button>
                  <button className="settings-btn-primary" onClick={handleSaveProvider}>保存</button>
                </div>
              )}
            </div>
            
            <div className="settings-item">
              <div className="settings-label-row">
                <label className="settings-label">模型列表</label>
                <button
                  type="button"
                  className="settings-add-btn-inline"
                  onClick={() => addModelToProvider(currentProvider.id)}
                >
                  <Plus size={12} />
                  添加
                </button>
              </div>
              <div className="settings-model-list">
                {currentProvider.models.map((m, index) => (
                  <div key={`${currentProvider.id}-${m}-${index}`} className="settings-model-row">
                    {modelEditIndex === index ? (
                      <input
                        className="settings-input settings-model-input"
                        value={modelDraft}
                        autoFocus
                        onChange={(e) => setModelDraft(e.target.value)}
                        onBlur={() => commitModel(currentProvider.id, index, modelDraft)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitModel(currentProvider.id, index, modelDraft)
                          if (e.key === 'Escape') {
                            setModelEditIndex(null)
                            setModelDraft('')
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`settings-model-btn ${modelTestStatus[m] === true ? 'tested' : ''}`}
                        onClick={() => testModel(currentProvider.id, m)}
                      >
                        <span>{m}</span>
                        <span className="model-btn-status">
                          {modelTestStatus[m] === 'loading' ? (
                            <Loader2 size={12} className="spin" />
                          ) : modelTestStatus[m] === true ? (
                            <CheckCircle size={12} />
                          ) : null}
                        </span>
                      </button>
                    )}
                    <div className="settings-model-actions">
                      <button
                        type="button"
                        className="settings-model-action-btn"
                        onClick={() => beginEditModel(index, m)}
                        title="编辑"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        className="settings-model-action-btn danger"
                        onClick={() => commitModel(currentProvider.id, index, '')}
                        title="删除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {currentProvider.models.length === 0 && (
                  <div className="settings-empty">暂无模型，点击添加</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <LocalAsrModelPanel />

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
              onClick={() => handleEditStyle(s)}
            >
              <div className="settings-style-card-top">
                <span className="settings-style-card-badge">
                  {s.value.startsWith('custom_') ? '自定义' : '默认'}
                </span>
                <div className="settings-style-card-meta">
                  {s.value.startsWith('custom_') ? (
                    <button
                      type="button"
                      className="settings-style-card-action danger"
                      onClick={(e) => { e.stopPropagation(); handleDeleteStyle(s.value); }}
                      title="删除"
                    >
                      <Trash2 size={11} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="settings-style-card-action danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        const defaultStyle = DEFAULT_STYLES.find(d => d.value === s.value)
                        if (!defaultStyle) return
                        const newStyles = customStyles.filter(style => style.value !== s.value)
                        saveStyles(newStyles)
                        setActiveStyleId(defaultStyle.value)
                        setLocalSettings(prev => ({
                          ...prev,
                          style: { ...prev.style, style: defaultStyle.value }
                        }))
                        showToast('已重置', 'success')
                      }}
                      title="重置"
                    >
                      <RotateCcw size={11} />
                    </button>
                  )}
                </div>
              </div>
              <div className="settings-style-card-header">
                <span className="settings-style-card-label">{s.label}</span>
                {activeStyleId === s.value && <Check size={14} className="settings-check" />}
              </div>
              <p className="settings-style-card-desc">{s.description}</p>
            </div>
          ))}
        </div>

        {showStyleModal && editingStyle && (
          <div className="settings-modal-overlay" onClick={() => { setShowStyleModal(false); setEditingStyle(null); setStyleForm({ label: '', description: '', prompt: '' }) }}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="settings-modal-header">
                <h4>{editingStyle.value.startsWith('custom_') ? '编辑风格' : '修改风格'}</h4>
                <button
                  type="button"
                  className="settings-modal-close"
                  onClick={() => { setShowStyleModal(false); setEditingStyle(null); setStyleForm({ label: '', description: '', prompt: '' }) }}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="settings-modal-body">
                <div className="settings-item">
                  <label className="settings-label">风格名称</label>
                  <input
                    type="text"
                    className="settings-input"
                    value={styleForm.label}
                    onChange={(e) => setStyleForm(prev => ({ ...prev, label: e.target.value }))}
                  />
                </div>
                <div className="settings-item">
                  <label className="settings-label">描述</label>
                  <textarea
                    className="settings-textarea"
                    value={styleForm.description}
                    onChange={(e) => setStyleForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="settings-item">
                  <label className="settings-label">Prompt提示词</label>
                  <textarea
                    className="settings-textarea"
                    value={styleForm.prompt}
                    onChange={(e) => setStyleForm(prev => ({ ...prev, prompt: e.target.value }))}
                  />
                </div>
              </div>
              <div className="settings-modal-footer">
                <button className="settings-btn-secondary" onClick={() => { setShowStyleModal(false); setEditingStyle(null); setStyleForm({ label: '', description: '', prompt: '' }) }}>
                  取消
                </button>
                <button className="settings-btn-primary" onClick={handleSaveStyle}>
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AiPromptTemplates
        isOpen={showPromptTemplatesModal}
        onClose={() => setShowPromptTemplatesModal(false)}
      />

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
              checked={localSettings.auto_analyze}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, auto_analyze: e.target.checked }))}
            />
            下载完成后自动生成AI笔记
          </label>
        </div>
      </div>

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

        .settings-group-actions {
          display: flex;
          align-items: center;
          gap: 8px;
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

        .settings-secondary-btn {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        /* Provider Tabs */
        .settings-provider-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--color-bg-secondary);
          border-radius: 12px;
          margin-bottom: 16px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          -ms-overflow-style: none;
          user-select: none;
        }

        .settings-provider-tabs::-webkit-scrollbar {
          display: none;
        }

        .settings-provider-tab {
          flex: 0 0 auto;
          min-width: 96px;
          padding: 10px 14px;
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
          white-space: nowrap;
        }

        .settings-provider-tab.active {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .settings-provider-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .settings-provider-name-text {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .settings-provider-config {
          padding: 16px;
          background: var(--color-bg-secondary);
          border-radius: 12px;
        }

        .settings-provider-edit {
          margin-bottom: 16px;
        }

        .settings-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(10, 12, 16, 0.18);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 72px 20px 20px;
          backdrop-filter: blur(4px);
        }

        .settings-modal {
          width: min(560px, 100%);
          max-height: min(78vh, 720px);
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
          border-radius: 16px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.12);
          overflow: hidden;
        }

        .settings-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .settings-modal-header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .settings-modal-close {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 10px;
          background: var(--color-bg-tertiary);
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .settings-modal-body {
          display: grid;
          gap: 16px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .settings-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 4px;
          border-top: 1px solid var(--color-border);
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

        .settings-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .settings-api-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .settings-api-row .settings-input {
          flex: 1;
        }

        .settings-visibility-btn,
        .settings-api-test-btn {
          border: none;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          font-size: 12px;
          background: var(--color-bg-tertiary);
          color: var(--color-text-secondary);
        }

        .settings-api-test-btn {
          white-space: nowrap;
        }

        .settings-inline-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
        }

        .settings-add-btn-inline {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border: none;
          border-radius: 8px;
          background: var(--color-primary-600);
          color: white;
          cursor: pointer;
          font-size: 12px;
        }

        .settings-model-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .settings-model-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .settings-provider-bar {
          position: relative;
          height: 6px;
          margin: 2px 12px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.08);
          cursor: pointer;
          overflow: hidden;
        }

        .settings-provider-bar-thumb {
          position: absolute;
          top: 0;
          left: 0;
          height: 4px;
          border-radius: 999px;
          background: rgba(76, 131, 255, 0.6);
          box-shadow: none;
          transition: transform 0.12s ease, width 0.12s ease, opacity 0.12s ease;
        }

        .settings-provider-bar:hover .settings-provider-bar-thumb {
          background: rgba(76, 131, 255, 0.78);
        }

        .settings-provider-bar.dragging .settings-provider-bar-thumb {
          transition: none;
        }

        .settings-provider-bar-thumb.hidden {
          opacity: 0;
        }

        .settings-model-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 12px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
        }

        .settings-model-btn.tested {
          border-color: var(--color-success);
        }

        .settings-model-input {
          flex: 1;
        }

        .settings-model-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .settings-model-action-btn {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: var(--color-bg-tertiary);
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .settings-model-action-btn.danger {
          color: var(--color-error);
        }

        .settings-empty {
          padding: 10px 12px;
          border: 1px dashed var(--color-border);
          border-radius: 10px;
          color: var(--color-text-tertiary);
          font-size: 12px;
        }

        /* Style Grid */
        .settings-style-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .settings-style-card {
          padding: 8px 9px 7px;
          background: var(--color-bg-secondary);
          border-radius: 9px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
          min-height: 68px;
        }

        .settings-style-card:hover {
          border-color: var(--color-primary-300);
          transform: translateY(-0.5px);
        }

        .settings-style-card.active {
          border-color: var(--color-primary-600);
          background: linear-gradient(180deg, rgba(67, 110, 238, 0.06), rgba(67, 110, 238, 0.02));
        }

        .settings-style-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .settings-style-card-badge {
          display: inline-flex;
          align-items: center;
          height: 18px;
          padding: 0 6px;
          border-radius: 999px;
          font-size: 10px;
          color: var(--color-text-tertiary);
          background: rgba(255,255,255,0.04);
        }

        .settings-style-card-meta {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .settings-style-card-action {
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--color-text-tertiary);
          cursor: pointer;
        }

        .settings-style-card-action.danger {
          color: var(--color-error);
        }

        .settings-style-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .settings-style-card-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .settings-check {
          color: var(--color-primary-600);
        }

        .settings-style-card-desc {
          font-size: 10px;
          color: var(--color-text-tertiary);
          margin-top: 2px;
          line-height: 1.35;
          min-height: 2.6em;
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

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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

        @media (max-width: 720px) {
          .settings-provider-tabs {
            flex-wrap: nowrap;
          }
          .settings-provider-tab {
            min-width: 88px;
          }
          .settings-provider-bar {
            margin-inline: 4px;
          }
          .settings-api-row {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
})

export default AiNoteSettings
