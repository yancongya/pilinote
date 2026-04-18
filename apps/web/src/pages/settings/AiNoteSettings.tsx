import { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { useSettingsStore } from '../../stores/settings'
import { useAiRuntimeState } from '../../hooks/useAiRuntimeState'
import { 
  Brain, 
  Key, 
  Clock, 
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Bot,
  Cpu,
  Cloud,
  Server,
  CheckCircle,
  Loader2,
  Layers3,
  FileText,
  LayoutGrid,
} from 'lucide-react'
import { useToast } from '../../components/Toast'
import { LocalAsrModelPanel } from '../../components/ai/LocalAsrModelPanel'
import AiPromptTemplates from './AiPromptTemplates'
import { PROMPT_TEMPLATE_CARDS, type PromptTemplateMeta } from '../../services/promptCatalog'
import { aiPromptTemplatesService } from '../../services/aiPromptTemplates'
import { aiRuntimeStateService } from '../../services/aiRuntimeState'

interface LLMProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
  isDefault?: boolean
  isCustom?: boolean
}

interface AiNoteLocalSettings {
  llm: {
    provider: string
    model: string
    api_key: string
    temperature: number
  }
  style: {
    length: number
    custom_styles: Array<{ value: string; label: string; description: string; prompt: string }>
  }
  format: {
    format: string
    include_timestamp: boolean
    include_summary: boolean
  }
  auto_analyze: boolean
}

interface AiNoteSettingsRef {
  hasUnsavedChanges: () => boolean
  saveSettings: () => Promise<void>
  getSavedStatus: () => 'idle' | 'saving' | 'saved' | 'error'
}

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
  const runtimeState = useAiRuntimeState()
  const { showToast } = useToast()
  
  const [localSettings, setLocalSettings] = useState<AiNoteLocalSettings>({
    llm: {
      provider: 'openai',
      base_url: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      api_key: '',
      temperature: 0.7,
    },
    style: {
      length: 500,
      custom_styles: [] as Array<{ value: string; label: string; description: string; prompt: string }>,
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
  
  const [promptTemplates, setPromptTemplates] = useState<Record<string, any>>({})
  const [defaultPromptTemplates, setDefaultPromptTemplates] = useState<Record<string, any>>({})
  const [selectedPromptCard, setSelectedPromptCard] = useState<PromptTemplateMeta | null>(null)
  const [selectedPromptCategory, setSelectedPromptCategory] = useState<'基础' | '分层' | '风格' | '格式'>('基础')
  const [customStyles, setCustomStyles] = useState<Array<{ value: string; label: string; description: string; prompt: string }>>([])
  const [showCreateStyleModal, setShowCreateStyleModal] = useState(false)
  const [createStyleForm, setCreateStyleForm] = useState({ label: '', description: '', prompt: '' })
  const [modelEditIndex, setModelEditIndex] = useState<number | null>(null)
  const [modelDraft, setModelDraft] = useState('')
  const [modelTestStatus, setModelTestStatus] = useState<Record<string, boolean | 'loading'>>({})
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

  const setNestedValue = (obj: Record<string, any>, path: string[], value: any) => {
    let cursor: any = obj
    for (let i = 0; i < path.length - 1; i += 1) {
      const key = path[i]
      if (typeof cursor[key] !== 'object' || cursor[key] === null) {
        cursor[key] = {}
      }
      cursor = cursor[key]
    }
    cursor[path[path.length - 1]] = value
  }

  // 加载数据
  useEffect(() => {
    const load = async () => {
      const dbProviders = Array.isArray((settings as any)?.llm?.providers)
        ? ((settings as any).llm.providers as LLMProvider[])
        : []
      const savedProviders = localStorage.getItem(STORAGE_KEY_PROVIDERS)
      const legacyProviders: LLMProvider[] = savedProviders ? JSON.parse(savedProviders) : []
      const providerMap = new Map<string, LLMProvider>()

      DEFAULT_PROVIDERS.forEach(provider => {
        providerMap.set(provider.id, provider)
      })
      dbProviders.forEach(provider => {
        providerMap.set(provider.id, {
          ...provider,
          baseUrl: provider.baseUrl || '',
          apiKey: provider.apiKey || '',
          models: Array.isArray(provider.models) ? provider.models : [],
        })
      })
      legacyProviders.forEach(provider => {
        providerMap.set(provider.id, {
          ...provider,
          baseUrl: provider.baseUrl || '',
          apiKey: provider.apiKey || '',
          models: Array.isArray(provider.models) ? provider.models : [],
        })
      })
      const mergedProviders = Array.from(providerMap.values())
      setProviders(mergedProviders)
      if (legacyProviders.length > 0) {
        await updateSettings({
          llm: {
            ...(settings?.llm || {}),
            providers: mergedProviders,
          },
        })
        localStorage.removeItem(STORAGE_KEY_PROVIDERS)
      }

      const currentAiNote = settings?.ai_note
      const unifiedLlm = settings?.llm
      if (currentAiNote || unifiedLlm) {
        const currentProviderId = unifiedLlm?.provider || currentAiNote?.llm.provider || 'openai'
        const currentProvider = providerMap.get(currentProviderId) || providerMap.get('openai') || DEFAULT_PROVIDERS[0]
        setLocalSettings({
          llm: {
            provider: currentProviderId,
            base_url: unifiedLlm?.base_url || currentProvider.baseUrl,
            model: unifiedLlm?.model || currentAiNote?.llm.model || currentProvider.models[0] || 'gpt-4o-mini',
            api_key: unifiedLlm?.api_key || currentAiNote?.llm.api_key || currentProvider.apiKey || '',
            temperature: unifiedLlm?.temperature ?? currentAiNote?.llm.temperature ?? 0.7,
          },
          style: {
            length: currentAiNote?.style.length || 500,
            custom_styles: currentAiNote?.style.custom_styles || [],
          },
          format: {
            format: currentAiNote?.format.format || 'markdown',
            include_timestamp: currentAiNote?.format.include_timestamp ?? true,
            include_summary: currentAiNote?.format.include_summary ?? true,
          },
          auto_analyze: currentAiNote?.auto_analyze ?? false,
        })
        setActiveProviderId(currentProviderId)
        setCustomStyles(currentAiNote?.style.custom_styles || [])
      }

      try {
        const [currentRes, defaultRes] = await Promise.all([
          aiPromptTemplatesService.getTemplates(),
          aiPromptTemplatesService.getDefaultTemplates(),
        ])
        setPromptTemplates(currentRes.templates || {})
        setDefaultPromptTemplates(defaultRes.templates || {})
      } catch (error) {
        showToast(`加载 prompt 模板失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
      }

      await aiRuntimeStateService.refresh()
    }
    load().catch(() => {
      setProviders(DEFAULT_PROVIDERS)
    })
  }, [settings?.ai_note, settings?.llm, showToast, updateSettings])

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
  const saveProviders = async (newProviders: LLMProvider[]) => {
    try {
      const providerMap = new Map<string, LLMProvider>()

      DEFAULT_PROVIDERS.forEach(provider => {
        providerMap.set(provider.id, provider)
      })
      newProviders.forEach(provider => {
        providerMap.set(provider.id, provider)
      })

      const mergedProviders = Array.from(providerMap.values())
      setProviders(mergedProviders)
      await updateSettings({
        llm: {
          ...((settings as any)?.llm || {
            provider: 'openai',
            base_url: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            api_key: '',
            temperature: 0.7,
          }),
          providers: mergedProviders,
        },
      })
    } catch (error) {
      showToast(`保存服务商失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    }
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
    void saveProviders(newProviders)
    setActiveProviderId(id)
    setEditingProvider(newProvider)
    setProviderForm({ name: newProvider.name, baseUrl: '', apiKey: '', models: '' })
    setShowApiKey(false)
  }

  const handleDeleteProvider = (id: string) => {
    const newProviders = providers.filter(p => p.id !== id)
    void saveProviders(newProviders)
    if (activeProviderId === id) {
      const nextProviderId = newProviders[0]?.id || 'openai'
      const nextProvider = newProviders.find(p => p.id === nextProviderId) || DEFAULT_PROVIDERS.find(p => p.id === nextProviderId)
      setActiveProviderId(nextProviderId)
      if (nextProvider) {
        setLocalSettings(prev => ({
          ...prev,
          llm: {
            ...prev.llm,
            provider: nextProviderId,
            base_url: nextProvider.baseUrl,
            api_key: nextProvider.apiKey,
            model: nextProvider.models[0] || prev.llm.model,
          },
        }))
      }
    }
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
    
    void saveProviders(newProviders)
    if (activeProviderId === id || (editingProvider && editingProvider.id === activeProviderId)) {
      setLocalSettings(prev => ({
        ...prev,
        llm: {
          ...prev.llm,
          provider: id,
          base_url: newProvider.baseUrl,
          api_key: newProvider.apiKey,
          model: newProvider.models[0] || prev.llm.model,
        },
      }))
    }
    setEditingProvider(null)
    setProviderForm({ name: '', baseUrl: '', apiKey: '', models: '' })
    setShowApiKey(false)
    showToast(editingProvider ? '已更新' : '已添加', 'success')
  }

  const handleResetProvider = (id: string) => {
    const defaultP = DEFAULT_PROVIDERS.find(p => p.id === id)
    if (defaultP) {
      const newProviders = providers.map(p => p.id === id ? { ...p, baseUrl: defaultP.baseUrl, apiKey: '', models: defaultP.models } : p)
      void saveProviders(newProviders)
      if (activeProviderId === id) {
        setLocalSettings(prev => ({
          ...prev,
          llm: {
            ...prev.llm,
            base_url: defaultP.baseUrl,
            api_key: '',
            model: defaultP.models[0] || prev.llm.model,
          },
        }))
      }
      showToast('已重置', 'success')
    }
  }

  const currentProvider = providers.find(p => p.id === activeProviderId)
  const promptCategoryIcons = {
    基础: FileText,
    分层: Layers3,
    风格: Sparkles,
    格式: LayoutGrid,
  } as const

  const promptCardData = useMemo(() => {
    const builtinCards = PROMPT_TEMPLATE_CARDS.map(card => {
      const currentValue = card.path.reduce<any>((cursor, key) => (cursor ? cursor[key] : undefined), promptTemplates)
      const defaultValue = card.path.reduce<any>((cursor, key) => (cursor ? cursor[key] : undefined), defaultPromptTemplates)
      const currentText = Array.isArray(currentValue)
        ? currentValue.join('\n')
        : typeof currentValue === 'string'
          ? currentValue
          : ''
      const defaultText = Array.isArray(defaultValue)
        ? defaultValue.join('\n')
        : typeof defaultValue === 'string'
          ? defaultValue
          : ''
      return {
        ...card,
        preview: currentText || defaultText || '点击编辑',
        modified: currentText !== defaultText,
      }
    })
    const styleCards = customStyles.map(style => {
      const key = `t3.${style.value}`
      const currentValue = promptTemplates?.layers?.t3?.[style.value]
      const defaultValue = defaultPromptTemplates?.layers?.t3?.[style.value]
      const currentText = typeof currentValue === 'string' ? currentValue : ''
      const defaultText = typeof defaultValue === 'string' ? defaultValue : ''
      return {
        key,
        title: style.label || '未命名风格',
        category: '风格',
        path: ['layers', 't3', style.value],
        kind: 'text' as const,
        preview: currentText || style.prompt || defaultText || '点击编辑',
        modified: currentText !== defaultText,
        isCustomStyle: true,
        styleValue: style.value,
        styleLabel: style.label,
        styleDescription: style.description,
        stylePrompt: style.prompt,
      }
    })
    return [...builtinCards, ...styleCards]
  }, [customStyles, defaultPromptTemplates, promptTemplates])
  const visiblePromptCards = useMemo(
    () => promptCardData.filter(card => card.category === selectedPromptCategory),
    [promptCardData, selectedPromptCategory],
  )

  const handleOpenPromptCard = (card: PromptTemplateMeta) => {
    setSelectedPromptCard(card)
  }

  const handleResetPromptCard = async (card: any) => {
    try {
      if (card.isCustomStyle) {
        const nextCustomStyles = customStyles.filter(style => style.value !== card.styleValue)
        setCustomStyles(nextCustomStyles)
        await updateSettings({
          ai_note: {
            ...(settings?.ai_note || {}),
            style: {
              ...(settings?.ai_note?.style || {}),
              custom_styles: nextCustomStyles,
            } as any,
          } as any,
        })

        const currentTemplates = await aiPromptTemplatesService.getTemplates()
        const nextTemplates = currentTemplates.templates || {}
        if (nextTemplates?.layers?.t3) {
          delete nextTemplates.layers.t3[card.styleValue]
        }
        await aiPromptTemplatesService.saveTemplates(nextTemplates)
        await fetchSettings()
        showToast('已重置自定义风格', 'success')
        return
      }

      const defaults = defaultPromptTemplates
      const current = promptTemplates
      const nextTemplates = JSON.parse(JSON.stringify(current))
      const defaultValue = card.path.reduce((cursor: any, key: string) => (cursor ? cursor[key] : undefined), defaults as Record<string, any>)
      if (card.kind === 'lines') {
        setNestedValue(nextTemplates, card.path, Array.isArray(defaultValue) ? defaultValue : [])
      } else {
        setNestedValue(nextTemplates, card.path, typeof defaultValue === 'string' ? defaultValue : '')
      }
      await aiPromptTemplatesService.saveTemplates(nextTemplates)
      setPromptTemplates(nextTemplates)
      showToast('已重置为默认模板', 'success')
    } catch (error) {
      showToast(`重置失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    }
  }

  const handleCreateCustomStyle = async () => {
    if (!createStyleForm.label.trim()) {
      showToast('请输入风格名称', 'error')
      return
    }
    const value = `custom_${Date.now()}`
    const newStyle = {
      value,
      label: createStyleForm.label.trim(),
      description: createStyleForm.description.trim(),
      prompt: createStyleForm.prompt.trim(),
    }
    const nextCustomStyles = [...customStyles, newStyle]
    try {
      const nextTemplates = JSON.parse(JSON.stringify(promptTemplates))
      if (!nextTemplates.layers) nextTemplates.layers = {}
      if (!nextTemplates.layers.t3) nextTemplates.layers.t3 = {}
      nextTemplates.layers.t3[value] = newStyle.prompt
      await aiPromptTemplatesService.saveTemplates(nextTemplates)
      await updateSettings({
        ai_note: {
          ...(settings?.ai_note || {}),
          style: {
            ...(settings?.ai_note?.style || {}),
            custom_styles: nextCustomStyles,
          } as any,
        } as any,
      })
      setPromptTemplates(nextTemplates)
      setCustomStyles(nextCustomStyles)
      setCreateStyleForm({ label: '', description: '', prompt: '' })
      setShowCreateStyleModal(false)
      setSelectedPromptCategory('风格')
      showToast('已创建新风格', 'success')
    } catch (error) {
      showToast(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error')
    }
  }

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
    void saveProviders(newProviders)
    setModelEditIndex(null)
    setModelDraft('')
  }

  const addModelToProvider = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return
    const nextModels = [...provider.models, `model_${provider.models.length + 1}`]
    const newProviders = providers.map(p => p.id === providerId ? { ...p, models: nextModels } : p)
    void saveProviders(newProviders)
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
          base_url: provider.baseUrl,
          model: modelName,
          api_key: provider.apiKey,
        },
      }))
      await updateSettings({
        llm: {
          ...((settings as any)?.llm || {
            provider: provider.id,
            base_url: provider.baseUrl,
            model: modelName,
            api_key: provider.apiKey,
            temperature: localSettings.llm.temperature,
          }),
          provider: provider.id,
          base_url: provider.baseUrl,
          model: modelName,
          api_key: provider.apiKey,
          temperature: localSettings.llm.temperature,
          providers,
        },
        ai_note: {
          ...(settings?.ai_note || {}),
          style: {
            length: localSettings.style.length,
            custom_styles: customStyles,
          } as any,
          format: {
            ...(settings?.ai_note?.format || {}),
            ...localSettings.format,
          },
          auto_analyze: localSettings.auto_analyze,
        },
      })
      await aiRuntimeStateService.recordTestedModel(provider.id, modelName)
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

  const runtimeTestedModelsForActiveProvider = useMemo(
    () => runtimeState.testedModels[currentProvider?.id || activeProviderId] || [],
    [runtimeState.testedModels, currentProvider?.id, activeProviderId],
  )

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => false,
    saveSettings: async () => {
      try {
        const currentAiNote = settings?.ai_note || {
          llm: { provider: 'openai', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', api_key: '', temperature: 0.7 },
          style: { length: 500 },
          format: { format: 'markdown', include_timestamp: true, include_summary: true },
          auto_analyze: false,
        }
        await updateSettings({
          llm: {
            ...((settings as any)?.llm || {
              provider: 'openai',
              base_url: 'https://api.openai.com/v1',
              model: 'gpt-4o-mini',
              api_key: '',
              temperature: 0.7,
            }),
            provider: localSettings.llm.provider,
            base_url: localSettings.llm.base_url,
            model: localSettings.llm.model,
            api_key: localSettings.llm.api_key,
            temperature: localSettings.llm.temperature,
            providers,
          },
          ai_note: {
            ...currentAiNote,
            style: {
              length: localSettings.style.length,
              custom_styles: customStyles,
            } as any,
            format: {
              ...currentAiNote.format,
              ...localSettings.format,
            },
            auto_analyze: localSettings.auto_analyze,
          },
        })
        await fetchSettings()
        setActiveProviderId(localSettings.llm.provider)
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
    <div className="stg-panel">
      {/* 服务商管理 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <h3 className="stg-group-title">
            <Brain size={18} />
            AI 服务商
          </h3>
          <div className="settings-group-actions">
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
              <div className="stg-item">
                <label className="stg-label">服务商名称</label>
                <input
                  type="text"
                  className="stg-input"
                  placeholder="如：OpenAI"
                  value={editingProvider?.id === currentProvider.id ? providerForm.name : currentProvider.name}
                  onChange={(e) => {
                    if (editingProvider?.id !== currentProvider.id) return
                    setProviderForm(prev => ({ ...prev, name: e.target.value }))
                  }}
                />
              </div>

              <div className="stg-item">
                <label className="stg-label">Base URL</label>
                <input
                  type="text"
                  className="stg-input"
                  placeholder="API地址"
                  value={editingProvider?.id === currentProvider.id ? providerForm.baseUrl : currentProvider.baseUrl}
                  onChange={(e) => {
                    if (editingProvider?.id !== currentProvider.id) return
                    setProviderForm(prev => ({ ...prev, baseUrl: e.target.value }))
                  }}
                />
              </div>
              
              <div className="stg-item">
                <div className="settings-label-row">
                  <label className="stg-label">
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
                    className="stg-input"
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
            
            <div className="stg-item">
              <div className="settings-label-row">
                <label className="stg-label">模型列表</label>
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
                        className={`settings-model-btn ${runtimeTestedModelsForActiveProvider.includes(m) || modelTestStatus[m] === true ? 'tested' : ''}`}
                        onClick={() => testModel(currentProvider.id, m)}
                      >
                        <span className="settings-model-btn-text">{m}</span>
                        <span className="model-btn-status">
                          {modelTestStatus[m] === 'loading' ? (
                            <Loader2 size={12} className="spin" />
                          ) : runtimeTestedModelsForActiveProvider.includes(m) || modelTestStatus[m] === true ? (
                            <span className="model-btn-status-badge">已验证</span>
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

      {/* prompt 管理 */}
      <div className="stg-group">
        <div className="stg-group-header">
          <h3 className="stg-group-title">
            <Sparkles size={18} />
            prompt管理
          </h3>
        </div>
        <div className="settings-style-section">
          <div className="settings-style-section-title settings-style-section-title-row">
            <span>{selectedPromptCategory}</span>
            <div className="settings-style-category-switcher">
              {(Object.keys(promptCategoryIcons) as Array<keyof typeof promptCategoryIcons>).map(category => {
                const Icon = promptCategoryIcons[category]
                return (
                  <button
                    key={category}
                    type="button"
                    className={`settings-style-category-btn ${selectedPromptCategory === category ? 'active' : ''}`}
                    onClick={() => setSelectedPromptCategory(category)}
                    title={category}
                  >
                    <Icon size={14} />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="settings-style-grid">
            {visiblePromptCards.map(card => {
              const data = promptCardData.find(item => item.key === card.key)
              return (
                <div
                    key={card.key}
                    className={`settings-style-card ${data?.modified ? 'active' : ''}`}
                  onClick={() => handleOpenPromptCard(card)}
                    role="button"
                    tabIndex={0}
                    title="点击编辑 prompt"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleOpenPromptCard(card)
                      }
                    }}
                  >
                  <div className="settings-style-card-top">
                    <span className="settings-style-card-badge">{card.category}</span>
                    <div className="settings-style-card-meta">
                      <button
                        type="button"
                        className="settings-style-card-action"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleResetPromptCard(card)
                        }}
                        title="重置"
                      >
                        <RotateCcw size={11} />
                      </button>
                      {data?.modified && <span className="settings-style-card-status">已修改</span>}
                    </div>
                  </div>
                  <div className="settings-style-card-header">
                    <span className="settings-style-card-label">{card.title}</span>
                  </div>
                  <p className="settings-style-card-desc">{data?.preview || '点击编辑'}</p>
                </div>
              )
            })}
            {selectedPromptCategory === '风格' && (
              <button
                type="button"
                className="settings-style-card settings-style-card-create"
                onClick={() => setShowCreateStyleModal(true)}
              >
                <div className="settings-style-card-top">
                  <span className="settings-style-card-badge">新建</span>
                </div>
                <div className="settings-style-card-header">
                  <span className="settings-style-card-label">＋</span>
                </div>
                <p className="settings-style-card-desc">创建新的风格</p>
              </button>
            )}
          </div>
        </div>
      </div>

      <AiPromptTemplates
        isOpen={Boolean(selectedPromptCard)}
        onClose={() => setSelectedPromptCard(null)}
        card={selectedPromptCard}
      />

      {showCreateStyleModal && (
        <div className="settings-modal-overlay" onClick={() => setShowCreateStyleModal(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h4>创建新风格</h4>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setShowCreateStyleModal(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="settings-modal-body">
              <div className="stg-item">
                <label className="stg-label">风格名称</label>
                <input
                  type="text"
                  className="stg-input"
                  value={createStyleForm.label}
                  onChange={(e) => setCreateStyleForm(prev => ({ ...prev, label: e.target.value }))}
                />
              </div>
              <div className="stg-item">
                <label className="stg-label">描述</label>
                <textarea
                  className="settings-textarea"
                  value={createStyleForm.description}
                  onChange={(e) => setCreateStyleForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="stg-item">
                <label className="stg-label">Prompt</label>
                <textarea
                  className="settings-textarea"
                  value={createStyleForm.prompt}
                  onChange={(e) => setCreateStyleForm(prev => ({ ...prev, prompt: e.target.value }))}
                />
              </div>
            </div>
            <div className="settings-modal-footer">
              <button className="settings-btn-secondary" onClick={() => setShowCreateStyleModal(false)}>
                取消
              </button>
              <button className="settings-btn-primary" onClick={handleCreateCustomStyle}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自动功能 */}
      <div className="stg-group">
        <h3 className="stg-group-title">
          <Clock size={18} />
          自动功能
        </h3>
        
        <div className="stg-item">
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
          gap: 6px;
          padding: 6px;
          background: var(--color-bg-tertiary);
          border-radius: 0;
          margin-bottom: 12px;
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
          min-width: 72px;
          padding: 10px 16px;
          border-radius: 0;
          font-size: 13px;
          font-weight: 500;
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
        }

        .settings-provider-tab.active {
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06);
        }

        .settings-provider-tab:hover:not(.active) {
          background: rgba(255, 255, 255, 0.06);
          color: var(--color-text-primary);
        }

        .settings-provider-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
        }

        .settings-provider-tab.active .settings-provider-icon {
          opacity: 1;
        }

        .settings-provider-name-text {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .settings-provider-config {
          padding: 20px;
          background: var(--color-bg-secondary);
          border-radius: 0;
          border: 1px solid var(--color-border);
        }

        .settings-provider-edit {
          display: grid;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--color-border);
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
          padding: 12px 14px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          border-radius: 0;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }

        .settings-model-btn:hover {
          background: var(--color-bg-secondary);
          border-color: var(--color-primary-400);
        }

        .settings-model-btn.tested {
          border-color: var(--color-success);
          background: rgba(34, 197, 94, 0.06);
        }

        .settings-model-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .settings-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 12px;
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
        }

        .settings-helper-text {
          margin: 0;
          font-size: 12px;
          color: var(--color-text-tertiary);
          line-height: 1.5;
        }

        .settings-model-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
        }

        .settings-model-grid {
          align-items: stretch;
        }

        .settings-model-selector {
          display: grid;
          gap: 10px;
        }

        .settings-model-selector:hover,
        .settings-model-selector:hover .settings-input,
        .settings-model-selector:hover .settings-select,
        .settings-model-selector:hover .settings-model-card,
        .settings-model-selector:hover .settings-model-icon-btn {
          background: inherit !important;
        }

        .settings-model-selector-bar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          gap: 8px;
          align-items: center;
        }

        .settings-select-wrap {
          position: relative;
          min-width: 0;
          flex: 1 1 auto;
        }

        .settings-model-select {
          position: relative;
          z-index: 2;
          width: 100%;
          appearance: none;
          padding-right: 36px;
          cursor: pointer;
        }

        .settings-select-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          z-index: 1;
          color: var(--color-text-tertiary);
        }

        .settings-model-preview {
          margin-bottom: 12px;
        }

        .settings-model-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
          border-radius: 14px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          min-width: 0;
        }

        .settings-model-card.active {
          border-color: var(--color-primary-400);
          background: linear-gradient(180deg, rgba(67, 110, 238, 0.08), rgba(67, 110, 238, 0.03));
        }

        .settings-model-card-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: start;
          gap: 12px;
        }

        .settings-model-card-main {
          min-width: 0;
        }

        .settings-model-card-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .settings-model-card-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: var(--color-text-tertiary);
          word-break: break-all;
        }

        .settings-model-state {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .settings-model-state.state-ready {
          background: rgba(34, 197, 94, 0.12);
          color: var(--color-success);
          border-color: rgba(34, 197, 94, 0.18);
        }

        .settings-model-state.state-downloading {
          background: rgba(59, 130, 246, 0.12);
          color: var(--color-primary-600);
          border-color: rgba(59, 130, 246, 0.18);
        }

        .settings-model-state.state-failed {
          background: rgba(239, 68, 68, 0.12);
          color: var(--color-error);
          border-color: rgba(239, 68, 68, 0.18);
        }

        .settings-model-state.state-not_downloaded {
          background: rgba(148, 163, 184, 0.12);
          color: var(--color-text-secondary);
          border-color: rgba(148, 163, 184, 0.18);
        }

        .settings-model-progress {
          display: grid;
          gap: 6px;
        }

        .settings-model-progress-bar {
          height: 8px;
          border-radius: 999px;
          background: var(--color-bg-tertiary);
          overflow: hidden;
          border: 1px solid var(--color-border);
        }

        .settings-model-progress-bar > div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--color-primary-500), var(--color-primary-300));
        }

        .settings-model-progress-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--color-text-tertiary);
          min-width: 0;
        }

        .settings-model-error {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.08);
          color: var(--color-error);
          font-size: 12px;
          line-height: 1.4;
        }

        .settings-model-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .settings-model-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid var(--color-border);
          border-radius: 10px;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          cursor: pointer;
          flex: 0 0 auto;
        }

        .settings-model-icon-btn.primary {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
        }

        .settings-model-icon-btn.danger {
          color: var(--color-error);
        }

        .settings-model-icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .settings-model-selector-bar {
            grid-template-columns: 1fr;
          }

          .settings-model-selector-bar .settings-model-icon-btn {
            width: 100%;
            height: 38px;
          }

          .settings-model-list {
            grid-template-columns: 1fr;
          }
        }

        .settings-model-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: 10px;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-size: 12px;
          cursor: pointer;
        }

        .settings-model-action-btn.primary {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
        }

        .settings-model-action-btn.danger {
          color: var(--color-error);
        }

        .settings-model-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .settings-model-action-btn .spin {
          width: 12px;
          height: 12px;
        }

        /* Style Grid */
        .settings-style-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .settings-style-section {
          display: grid;
          gap: 8px;
          margin-top: 8px;
        }

        .settings-style-section-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          letter-spacing: 0.02em;
        }

        .settings-style-section-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .settings-style-category-switcher {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .settings-style-category-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-bg-primary);
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .settings-style-category-btn.active {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
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
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
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
