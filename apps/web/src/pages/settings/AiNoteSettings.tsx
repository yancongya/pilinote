import { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import type { Settings } from '../../stores/settings'
import { useSettingsStore } from '../../stores/settings'
import { useAiRuntimeState } from '../../hooks/useAiRuntimeState'
import {
  Brain, 
  Key, 
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
  Package,
  Eye,
  EyeOff,
  Wifi,
  X,
} from 'lucide-react'
import { useToast } from '../../components/Toast'
import { LocalAsrModelPanel } from '../../components/ai/LocalAsrModelPanel'
import PromptEditorModal from './PromptEditorModal'
import { PROMPT_TEMPLATE_CARDS, type PromptTemplateMeta } from '../../services/promptCatalog'
import { aiPromptTemplatesService } from '../../services/aiPromptTemplates'
import { aiRuntimeStateService } from '../../services/aiRuntimeState'
import { SettingsField, SettingsSection, SettingsToggleRow } from './shared'

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
    base_url: string
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
  }
  outputs: {
    page: {
      enabled: boolean
      llm: {
        provider: string
        base_url: string
        model: string
        api_key: string
        temperature: number
      }
    }
    image: {
      enabled: boolean
      llm: {
        provider: string
        base_url: string
        model: string
        api_key: string
        temperature: number
      }
    }
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
    },
    outputs: {
      page: {
        enabled: false,
        llm: {
          provider: 'openai',
          base_url: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          api_key: '',
          temperature: 0.7,
        },
      },
      image: {
        enabled: false,
        llm: {
          provider: 'openai',
          base_url: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          api_key: '',
          temperature: 0.7,
        },
      },
    },
    auto_analyze: false,
  })
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // 服务商列表
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const providersRef = useRef<LLMProvider[]>([])
  const [activeProviderId, setActiveProviderId] = useState('openai')
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null)
  const [providerForm, setProviderForm] = useState({ name: '', baseUrl: '', apiKey: '', models: '' })
  const [showApiKey, setShowApiKey] = useState(false)
  
  const [promptTemplates, setPromptTemplates] = useState<Record<string, any>>({})
  const [defaultPromptTemplates, setDefaultPromptTemplates] = useState<Record<string, any>>({})
  const [selectedPromptCard, setSelectedPromptCard] = useState<PromptTemplateMeta | null>(null)
  const [selectedPromptCategory, setSelectedPromptCategory] = useState<'通用' | 'Markdown' | '扩展产物' | '风格'>('通用')
  const [customStyles, setCustomStyles] = useState<Array<{ value: string; label: string; description: string; prompt: string }>>([])
  const [showCreateStyleModal, setShowCreateStyleModal] = useState(false)
  const [createStyleForm, setCreateStyleForm] = useState({ label: '', description: '', prompt: '' })
  const [modelEditIndex, setModelEditIndex] = useState<number | null>(null)
  const [modelDraft, setModelDraft] = useState('')
  const [modelTestStatus, setModelTestStatus] = useState<Record<string, boolean | 'loading'>>({})
  const [providerTestingId, setProviderTestingId] = useState<string | null>(null)
  const providerTabsRef = useRef<HTMLDivElement | null>(null)
  const providerBarRef = useRef<HTMLDivElement | null>(null)
  const providerSectionRef = useRef<HTMLDivElement | null>(null)
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
  const providerReorderRef = useRef({
    pressedId: '' as string,
    startX: 0,
    startY: 0,
    startIndex: -1,
    dragging: false,
    timer: 0 as any,
    didReorder: false,
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
      const providerMap = new Map<string, LLMProvider>()

      // Preserve DB order (user custom sort). Append missing defaults afterwards.
      dbProviders.forEach(provider => {
        providerMap.set(provider.id, {
          ...provider,
          baseUrl: provider.baseUrl || '',
          apiKey: provider.apiKey || '',
          models: Array.isArray(provider.models) ? provider.models : [],
        })
      })
      DEFAULT_PROVIDERS.forEach(provider => {
        if (providerMap.has(provider.id)) return
        providerMap.set(provider.id, provider)
      })
      const mergedProviders = Array.from(providerMap.values())
      setProviders(mergedProviders)
      providersRef.current = mergedProviders

      const unifiedLlm = settings?.llm
      if (unifiedLlm) {
        const currentProviderId = unifiedLlm.provider || 'openai'
        const currentProvider = providerMap.get(currentProviderId) || providerMap.get('openai') || DEFAULT_PROVIDERS[0]
        setLocalSettings({
          llm: {
            provider: currentProviderId,
            base_url: unifiedLlm.base_url || currentProvider.baseUrl,
            model: unifiedLlm.model || currentProvider.models[0] || 'gpt-4o-mini',
            api_key: unifiedLlm.api_key || currentProvider.apiKey || '',
            temperature: unifiedLlm.temperature ?? 0.7,
          },
          style: {
            length: settings?.ai_note?.style.length || 500,
            custom_styles: settings?.ai_note?.style.custom_styles || [],
          },
          format: {
            format: settings?.ai_note?.format.format || 'markdown',
            include_timestamp: settings?.ai_note?.format.include_timestamp ?? true,
          },
          outputs: {
            page: {
              enabled: Boolean((settings as any)?.ai_note?.outputs?.page?.enabled),
              llm: {
                provider: ((settings as any)?.ai_note?.outputs?.page?.llm?.provider || currentProviderId),
                base_url: ((settings as any)?.ai_note?.outputs?.page?.llm?.base_url || unifiedLlm.base_url || currentProvider.baseUrl),
                model: ((settings as any)?.ai_note?.outputs?.page?.llm?.model || unifiedLlm.model || currentProvider.models[0] || 'gpt-4o-mini'),
                api_key: ((settings as any)?.ai_note?.outputs?.page?.llm?.api_key || unifiedLlm.api_key || ''),
                temperature: ((settings as any)?.ai_note?.outputs?.page?.llm?.temperature ?? unifiedLlm.temperature ?? 0.7),
              },
            },
            image: {
              enabled: Boolean((settings as any)?.ai_note?.outputs?.image?.enabled),
              llm: {
                provider: ((settings as any)?.ai_note?.outputs?.image?.llm?.provider || currentProviderId),
                base_url: ((settings as any)?.ai_note?.outputs?.image?.llm?.base_url || unifiedLlm.base_url || currentProvider.baseUrl),
                model: ((settings as any)?.ai_note?.outputs?.image?.llm?.model || unifiedLlm.model || currentProvider.models[0] || 'gpt-4o-mini'),
                api_key: ((settings as any)?.ai_note?.outputs?.image?.llm?.api_key || unifiedLlm.api_key || ''),
                temperature: ((settings as any)?.ai_note?.outputs?.image?.llm?.temperature ?? unifiedLlm.temperature ?? 0.7),
              },
            },
          },
          auto_analyze: settings?.ai_note?.auto_analyze ?? false,
        })
        setActiveProviderId(currentProviderId)
        setCustomStyles(settings?.ai_note?.style.custom_styles || [])
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

  const handleEditProvider = (provider: LLMProvider) => {
    setEditingProvider(provider)
    setProviderForm({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      models: provider.models.join(', '),
    })
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

  const handleSaveProvider = async () => {
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
    
    await saveProviders(newProviders)
    if (!editingProvider) {
      setActiveProviderId(id)
    }
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
    if (activeProviderId === id) {
      await updateSettings({
        llm: {
          ...((settings as any)?.llm || {
            provider: id,
            base_url: newProvider.baseUrl,
            model: newProvider.models[0] || localSettings.llm.model,
            api_key: newProvider.apiKey,
            temperature: localSettings.llm.temperature,
          }),
          provider: id,
          base_url: newProvider.baseUrl,
          model: newProvider.models.includes(localSettings.llm.model)
            ? localSettings.llm.model
            : (newProvider.models[0] || localSettings.llm.model),
          api_key: newProvider.apiKey,
          temperature: localSettings.llm.temperature,
          providers: newProviders,
        },
      })
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
  const isEditingCurrentProvider = Boolean(currentProvider && editingProvider?.id === currentProvider.id)
  const canDeleteCurrentProvider = Boolean(currentProvider && (currentProvider.isCustom || currentProvider.id.startsWith('custom_')))
  const promptCategoryIcons = {
    通用: FileText,
    Markdown: LayoutGrid,
    扩展产物: Package,
    风格: Sparkles,
  } as const

  const promptCategoryDesc: Record<keyof typeof promptCategoryIcons, string> = {
    通用: '通用写作守则与全局约束（影响所有输出）',
    Markdown: 'Markdown 笔记结构片段（如时间戳、截图标记、总结等）',
    扩展产物: '额外产物的生成指导（网页展示、图解图片等）',
    风格: '写作风格（语气与表达方式），不改变结构要求',
  }

  const getPromptCardHint = (card: PromptTemplateMeta): string | null => {
    const displayCategory = (card as any).displayCategory || card.category
    if (displayCategory === '风格') return null
    // Keep hints short; shown as native tooltip on hover.
    switch (card.key) {
      case 'base.system':
        return '系统级提示词：决定模型的整体角色与输出边界'
      case 'base.final':
        return '最终要求：全局质量约束（不编造、去水话、输出规范等）'
      case 'base_image_text.system':
        return '图文系统提示词：图文模式下的整体角色与输出边界'
      case 'base_image_text.final':
        return '图文最终要求：图文模式下的全局质量约束'
      case 'formats.timestamps':
        return '关键点时间戳：要求在全文贯穿时间戳并可回跳'
      case 'formats.screenshot':
        return '原片截图：要求输出 Screenshot 标记供后端截图插入'
      case 'formats.summary':
        return 'AI 总结：规定总结的结构与内容要点'
      case 'outputs.page':
        return '网页展示：生成网页展示产物的指导'
      case 'outputs.image':
        return '图解图片：生成图解图片产物的指导'
      default:
        return '点击编辑该提示词模板'
    }
  }

  const getPromptDisplayCategory = (rawCategory: string, key: string) => {
    // Only affects UI grouping; does not change prompt template key/path, so it won't affect prompt concatenation.
    if (rawCategory === '基础') return '通用' as const
    if (rawCategory === '格式') return 'Markdown' as const
    if (rawCategory === '扩展') return '扩展产物' as const
    if (rawCategory === '风格') return '风格' as const
    // Hide legacy internal layers from the UI (they are implementation details for prompt assembly).
    if (rawCategory === '分层') return null
    // Fallback: keep it visible under 通用
    return '通用' as const
  }

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
      const displayCategory = getPromptDisplayCategory(card.category, card.key)
      return {
        ...card,
        displayCategory,
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
        displayCategory: '风格' as const,
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
    () => promptCardData.filter(card => (card as any).displayCategory === selectedPromptCategory),
    [promptCardData, selectedPromptCategory],
  )

  useEffect(() => {
    // Ensure the active provider tab is visible and its config panel is in view (especially after adding).
    const container = providerTabsRef.current
    if (!container || !activeProviderId) return
    const safeId = (() => {
      try { return CSS.escape(activeProviderId) } catch { return activeProviderId }
    })()
    const btn = container.querySelector(`[data-provider-id="${safeId}"]`) as HTMLElement | null
    if (btn) {
      try {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      } catch {
        // ignore
      }
    }
    if (providerSectionRef.current) {
      try {
        providerSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch {
        // ignore
      }
    }
  }, [activeProviderId])

  useEffect(() => {
    providersRef.current = providers
  }, [providers])

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
    const providerKey = editingProvider?.id === providerId ? providerForm.apiKey : provider.apiKey
    const providerBaseUrl = editingProvider?.id === providerId ? providerForm.baseUrl.trim() : provider.baseUrl
    setModelTestStatus(prev => ({ ...prev, [modelName]: 'loading' }))
    try {
      const response = await fetch('/api/ai/test-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider.id,
          model: modelName,
          baseUrl: providerBaseUrl,
          apiKey: providerKey,
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
          base_url: providerBaseUrl,
          model: modelName,
          api_key: providerKey,
        },
      }))
      await updateSettings({
        llm: {
          ...((settings as any)?.llm || {
            provider: provider.id,
            base_url: providerBaseUrl,
            model: modelName,
            api_key: providerKey,
            temperature: localSettings.llm.temperature,
          }),
          provider: provider.id,
          base_url: providerBaseUrl,
          model: modelName,
          api_key: providerKey,
          temperature: localSettings.llm.temperature,
          providers,
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

  const testAllProviderModels = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider || provider.models.length === 0) return
    setProviderTestingId(providerId)
    try {
      for (const modelName of provider.models) {
        await testModel(providerId, modelName)
      }
      showToast(`已逐个测试完成: ${provider.name}`, 'success')
    } finally {
      setProviderTestingId(null)
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
        const currentAiNote = (settings?.ai_note ?? {
          style: { style: 'default', length: 500, custom_styles: [] },
          format: { format: 'markdown', include_timestamp: true },
          auto_analyze: false,
        }) as Settings['ai_note']
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
              ...currentAiNote.style,
              length: localSettings.style.length,
              custom_styles: customStyles,
            },
            format: {
              ...currentAiNote.format,
              ...localSettings.format,
            },
            outputs: localSettings.outputs as any,
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
    <div className="ai-note-settings">
      <SettingsSection
        title="AI 服务商"
        subtitle="管理模型提供方、Base URL 和 API Key"
        actions={(
          <button
            type="button"
            className="settings-icon-button"
            onClick={handleAddProvider}
            title="新建服务商"
          >
            <Plus size={18} />
          </button>
        )}
      >
        
        {/* 服务商Tabs */}
        <div
          className="settings-provider-tabs"
          ref={providerTabsRef}
        >
          {providers.map(p => (
            <button
              key={p.id}
              className={`settings-provider-tab ${activeProviderId === p.id ? 'active' : ''}`}
              data-provider-id={p.id}
              onPointerDown={(event) => {
                // Long-press to reorder providers (custom sort persisted to DB).
                if (event.button !== 0) return
                if (isEditingCurrentProvider) return
                const container = providerTabsRef.current
                if (!container) return
                const idx = providers.findIndex(item => item.id === p.id)
                providerReorderRef.current.pressedId = p.id
                providerReorderRef.current.startX = event.clientX
                providerReorderRef.current.startY = event.clientY
                providerReorderRef.current.startIndex = idx
                providerReorderRef.current.dragging = false
                providerReorderRef.current.didReorder = false
                if (providerReorderRef.current.timer) {
                  clearTimeout(providerReorderRef.current.timer)
                }
                providerReorderRef.current.timer = setTimeout(() => {
                  providerReorderRef.current.dragging = true
                  try {
                    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
                  } catch {
                    // ignore
                  }
                }, 260)
              }}
              onPointerMove={(event) => {
                const state = providerReorderRef.current
                if (!state.pressedId) return
                const moved = Math.abs(event.clientX - state.startX) + Math.abs(event.clientY - state.startY)
                if (!state.dragging) {
                  if (moved > 10 && state.timer) {
                    clearTimeout(state.timer)
                    state.timer = 0 as any
                  }
                  return
                }
                const container = providerTabsRef.current
                if (!container) return
                const tabs = Array.from(container.querySelectorAll<HTMLElement>('.settings-provider-tab'))
                const centerX = event.clientX
                let targetIndex = state.startIndex
                for (let i = 0; i < tabs.length; i += 1) {
                  const rect = tabs[i].getBoundingClientRect()
                  if (centerX >= rect.left && centerX <= rect.right) {
                    targetIndex = i
                    break
                  }
                }
                const currentIndex = providers.findIndex(item => item.id === state.pressedId)
                if (targetIndex !== currentIndex && targetIndex >= 0) {
                  const next = [...providers]
                  const [picked] = next.splice(currentIndex, 1)
                  next.splice(targetIndex, 0, picked)
                  state.didReorder = true
                  setProviders(next)
                }
              }}
              onPointerUp={() => {
                const state = providerReorderRef.current
                if (state.timer) {
                  clearTimeout(state.timer)
                  state.timer = 0 as any
                }
                const didReorder = state.didReorder
                state.pressedId = ''
                state.dragging = false
                state.didReorder = false
                if (didReorder) {
                  void saveProviders(providersRef.current)
                }
              }}
              onPointerCancel={() => {
                const state = providerReorderRef.current
                if (state.timer) {
                  clearTimeout(state.timer)
                  state.timer = 0 as any
                }
                state.pressedId = ''
                state.dragging = false
                state.didReorder = false
              }}
              onClick={() => {
                const state = providerReorderRef.current
                if (state.timer) {
                  clearTimeout(state.timer)
                  state.timer = 0 as any
                }
                if (state.dragging) return
                setActiveProviderId(p.id)
                setLocalSettings(prev => ({
                  ...prev,
                  llm: {
                    ...prev.llm,
                    provider: p.id,
                    base_url: p.baseUrl,
                    api_key: p.apiKey,
                    model: p.models.includes(prev.llm.model) ? prev.llm.model : (p.models[0] || prev.llm.model),
                  }
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
        <div ref={providerSectionRef}>
        {currentProvider && (
          <div className="settings-provider-config">
            <div className="settings-provider-header">
              <span className="settings-provider-name">{currentProvider.name}</span>
              <div className="settings-provider-actions">
                <button type="button" onClick={() => handleEditProvider(currentProvider)} title="编辑">
                  <Edit2 size={14} />
                </button>
                {currentProvider.isDefault && (
                  <button type="button" onClick={() => handleResetProvider(currentProvider.id)} title="重置">
                    <RotateCcw size={14} />
                  </button>
                )}
                {canDeleteCurrentProvider && (
                  <button type="button" onClick={() => handleDeleteProvider(currentProvider.id)} title="删除">
                    <Trash2 size={14} />
                  </button>
                )}
                {isEditingCurrentProvider && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProvider(null)
                        setProviderForm({ name: '', baseUrl: '', apiKey: '', models: '' })
                      }}
                      title="取消编辑"
                    >
                      <X size={14} />
                    </button>
                    <button type="button" onClick={handleSaveProvider} title="保存修改">
                      <CheckCircle size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="settings-provider-edit">
              <div className="settings-provider-row">
                <label className="settings-provider-row-label">服务商名称</label>
                <input
                  type="text"
                  className={`settings-input ${isEditingCurrentProvider ? 'is-editing' : 'is-readonly'}`}
                  placeholder="如：OpenAI"
                  value={isEditingCurrentProvider ? providerForm.name : currentProvider.name}
                  readOnly={!isEditingCurrentProvider}
                  onChange={(e) => {
                    if (!isEditingCurrentProvider) return
                    setProviderForm(prev => ({ ...prev, name: e.target.value }))
                  }}
                />
                <div className="settings-provider-row-actions"></div>
              </div>

              <div className="settings-provider-row">
                <label className="settings-provider-row-label">Base URL</label>
                <input
                  type="text"
                  className={`settings-input ${isEditingCurrentProvider ? 'is-editing' : 'is-readonly'}`}
                  placeholder="API地址"
                  value={isEditingCurrentProvider ? providerForm.baseUrl : currentProvider.baseUrl}
                  readOnly={!isEditingCurrentProvider}
                  onChange={(e) => {
                    if (!isEditingCurrentProvider) return
                    setProviderForm(prev => ({ ...prev, baseUrl: e.target.value }))
                  }}
                />
                <div className="settings-provider-row-actions"></div>
              </div>
              
              <div className="settings-provider-row">
                <label className="settings-provider-row-label">
                  <Key size={14} />
                  API Key
                </label>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className={`settings-input ${isEditingCurrentProvider ? 'is-editing' : 'is-readonly'}`}
                  placeholder="留空使用环境变量"
                  value={isEditingCurrentProvider ? providerForm.apiKey : currentProvider.apiKey}
                  readOnly={!isEditingCurrentProvider}
                  onChange={(e) => {
                    if (!isEditingCurrentProvider) return
                    setProviderForm(prev => ({ ...prev, apiKey: e.target.value }))
                  }}
                />
                <div className="settings-provider-row-actions">
                  <button
                    type="button"
                    className="settings-icon-btn"
                    onClick={() => setShowApiKey(prev => !prev)}
                    title={showApiKey ? '隐藏' : '显示'}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    className="settings-icon-btn"
                    onClick={() => void testAllProviderModels(currentProvider.id)}
                    disabled={!currentProvider.models.length || providerTestingId === currentProvider.id}
                    title="逐个测试该服务商所有模型"
                  >
                    {providerTestingId === currentProvider.id ? <Loader2 size={16} className="spin" /> : <Wifi size={16} />}
                  </button>
                </div>
              </div>
               
            </div>
            
            <div className="settings-provider-row">
              <label className="settings-provider-row-label">模型列表</label>
              <button
                type="button"
                className="settings-icon-btn"
                onClick={() => addModelToProvider(currentProvider.id)}
                title="添加模型"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="settings-model-list">
              {currentProvider.models.length === 0 ? (
                <div className="settings-empty">暂无模型，点击添加</div>
              ) : (
                currentProvider.models.map((m, index) => (
                  <div key={`${currentProvider.id}-${m}-${index}`} className="settings-model-item">
                    <span className="settings-model-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="settings-model-name">
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
                      ) : m}
                    </span>
                    <span className="settings-model-status">
                      {modelTestStatus[m] === 'loading' ? (
                        <span className="settings-model-status-loading"><Loader2 size={12} className="spin" />测试中</span>
                      ) : runtimeTestedModelsForActiveProvider.includes(m) || modelTestStatus[m] === true ? (
                        <span className="settings-model-status-success">已验证</span>
                      ) : null}
                    </span>
                    <span className="settings-model-actions">
                    <button
                      type="button"
                      className="settings-icon-btn"
                      onClick={() => testModel(currentProvider.id, m)}
                      title="测试该模型"
                    >
                      <Wifi size={12} />
                    </button>
                      <button
                        type="button"
                        className="settings-icon-btn"
                        onClick={() => beginEditModel(index, m)}
                        title="编辑"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        className="settings-icon-btn"
                        onClick={() => commitModel(currentProvider.id, index, '')}
                        title="删除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="本地 ASR 模型"
        subtitle="管理本地语音识别模型、下载状态和切换操作"
      >
        <LocalAsrModelPanel compact />
      </SettingsSection>

      <SettingsSection
        title="扩展产物"
        subtitle="为网页展示与生图生成单独配置模型（仅显示已测试通过的模型）"
      >
        {(['page', 'image'] as const).map((outputKey) => {
          const label = outputKey === 'page' ? '网页' : '图片'
          const output = localSettings.outputs[outputKey]
          const modelOptions = Object.entries(runtimeState.testedModels || {}).flatMap(([provider, models]) =>
            (models || []).map((model) => ({
              provider,
              model,
              value: `${provider}::${model}`,
              // Provider is intentionally not shown as a separate control; it's derived from the chosen model.
              label: model,
            }))
          )
          const currentValue = `${output.llm.provider}::${output.llm.model}`

          return (
            <div key={outputKey} style={{ display: 'grid', gap: '12px', padding: '12px 0' }}>
              <SettingsField label={`${label}模型`} hint={modelOptions.length ? '仅展示已测试通过的模型' : '暂无已测试通过的模型，请先在上方测试模型'}>
                <select
                  className="settings-select"
                  value={modelOptions.some(o => o.value === currentValue) ? currentValue : (modelOptions[0]?.value || '')}
                  onChange={(e) => {
                    const raw = e.target.value || ''
                    const [provider, model] = raw.split('::')
                    const providerCfg = providers.find(p => p.id === provider)
                    setLocalSettings(prev => ({
                      ...prev,
                      outputs: {
                        ...prev.outputs,
                        [outputKey]: {
                          ...prev.outputs[outputKey],
                          llm: {
                            ...prev.outputs[outputKey].llm,
                            provider: provider || prev.outputs[outputKey].llm.provider,
                            model: model || prev.outputs[outputKey].llm.model,
                            base_url: providerCfg?.baseUrl || prev.outputs[outputKey].llm.base_url,
                            api_key: providerCfg?.apiKey || prev.outputs[outputKey].llm.api_key,
                          },
                        },
                      },
                    }))
                  }}
                  disabled={!modelOptions.length}
                >
                  {modelOptions.length ? modelOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  )) : (
                    <option value="">请先测试模型</option>
                  )}
                </select>
              </SettingsField>
            </div>
          )
        })}
      </SettingsSection>

      <SettingsSection title="prompt管理">
        <div className="settings-style-section">
          <div className="settings-style-section-title settings-style-section-title-row">
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span>{selectedPromptCategory}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {promptCategoryDesc[selectedPromptCategory]}
              </span>
            </div>
            <div className="settings-style-category-switcher">
              {(Object.keys(promptCategoryIcons) as Array<keyof typeof promptCategoryIcons>).map(category => {
                const Icon = promptCategoryIcons[category]
                const accent = (() => {
                  if (category === '通用') return '#64748b'
                  if (category === 'Markdown') return '#3b82f6'
                  if (category === '扩展产物') return '#f97316'
                  if (category === '风格') return '#22c55e'
                  return '#a855f7'
                })()
                return (
                  <button
                    key={category}
                    type="button"
                    className={`settings-style-category-btn ${selectedPromptCategory === category ? 'active' : ''}`}
                    onClick={() => setSelectedPromptCategory(category)}
                    title={category}
                    style={{ ['--prompt-accent' as any]: accent } as React.CSSProperties}
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
              const promptAccent = (() => {
                const category = (card as any).displayCategory || card.category
                if (category === '通用') return '#64748b'
                if (category === 'Markdown') return '#3b82f6'
                if (category === '扩展产物') return '#f97316'
                if (category === '风格') return '#22c55e'
                return '#a855f7'
              })()
              const hoverHint = getPromptCardHint(card)
              const displayCategory = (card as any).displayCategory || card.category
              const displayTitle = displayCategory === '风格' ? card.title.replace(/^T\d+\s*/i, '') : card.title
              return (
                <div
                    key={card.key}
                    className={`settings-style-card ${data?.modified ? 'active' : ''}`}
                  onClick={() => handleOpenPromptCard(card)}
                    role="button"
                    tabIndex={0}
                    title={hoverHint || '点击编辑 prompt'}
                    style={{ ['--prompt-accent' as any]: promptAccent } as React.CSSProperties}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleOpenPromptCard(card)
                      }
                  }}
                >
                  <div className="settings-style-card-top">
                    <span className="settings-style-card-badge">{(card as any).displayCategory || card.category}</span>
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
                    <span className="settings-style-card-label">{displayTitle}</span>
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
      </SettingsSection>

      <PromptEditorModal
        isOpen={Boolean(selectedPromptCard)}
        onClose={() => setSelectedPromptCard(null)}
        mode="edit_template"
        card={selectedPromptCard}
        onSaved={(nextTemplates) => setPromptTemplates(nextTemplates)}
      />

      <PromptEditorModal
        isOpen={showCreateStyleModal}
        onClose={() => setShowCreateStyleModal(false)}
        mode="create_style"
        styleTitle={createStyleForm.label}
        stylePrompt={createStyleForm.prompt}
        onChangeStyleTitle={(value) => setCreateStyleForm(prev => ({ ...prev, label: value }))}
        onChangeStylePrompt={(value) => setCreateStyleForm(prev => ({ ...prev, prompt: value }))}
        onCreateStyle={handleCreateCustomStyle}
      />

      <SettingsSection title="自动功能">
        <SettingsToggleRow
          label="下载完成后自动生成AI笔记"
          checked={localSettings.auto_analyze}
          onChange={(checked) => setLocalSettings(prev => ({ ...prev, auto_analyze: checked }))}
        />
      </SettingsSection>

      <style>{`
        .ai-note-settings .settings-section + .settings-section {
          margin-top: 8px;
        }

        .ai-note-settings .settings-section-header {
          padding: 8px 14px;
        }

        .ai-note-settings .settings-page-content {
          padding-bottom: 96px;
        }

        .settings-section {
          padding: 16px;
          padding-bottom: 24px;
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
          position: relative;
          z-index: 10;
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

        .settings-icon-btn {
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: none !important;
          border-radius: 12px;
          background: transparent !important;
          color: var(--color-text-secondary) !important;
          cursor: pointer !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          margin: 0 !important;
          padding: 0 !important;
          position: relative;
          z-index: 100;
        }

        .settings-icon-btn:hover {
          background: var(--color-bg-secondary) !important;
          color: var(--color-text-primary) !important;
        }

        .settings-icon-btn svg {
          width: 18px;
          height: 18px;
          display: block;
        }

        .settings-secondary-btn {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        /* Provider Tabs */
        .settings-provider-tabs {
          display: flex;
          gap: 6px;
          padding: 0 0 8px;
          background: transparent;
          border-bottom: 1px solid var(--color-border);
          border-radius: 0;
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
          color: var(--color-primary-600);
          box-shadow: inset 0 -2px 0 var(--color-primary-600);
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
          padding: 12px 0 0;
          background: transparent;
          border: none;
          border-top: 1px solid transparent;
        }

        .settings-provider-edit {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--color-border);
        }

        .settings-provider-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0;
          border: none;
          background: transparent;
          min-height: auto;
        }

        .settings-provider-row-label {
          flex: 0 0 90px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary);
          white-space: nowrap;
        }

        .settings-provider-row-label svg {
          flex-shrink: 0;
        }

        .settings-provider-edit .settings-input {
          flex: 1 1 auto;
          min-width: 0;
          width: 0;
          padding: 10px 12px;
          font-size: 14px;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          box-sizing: border-box;
        }

        .settings-provider-edit .settings-input.is-readonly {
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          cursor: default;
        }

        .settings-provider-edit .settings-input.is-editing {
          background: var(--color-bg-primary);
          border-color: var(--color-primary-400);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.08);
        }

        .settings-provider-row-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Legacy .settings-modal* styles removed (now using shared <Modal />) */

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

        .settings-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .settings-label-row .settings-field-label {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .settings-model-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          background: transparent;
          padding: 0;
          border: none;
        }

        .settings-model-item {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 10px;
          padding: 12px 0;
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--color-border);
        }

        .settings-model-item:last-child {
          border-bottom: none;
        }

        .settings-model-index {
          flex: 0 0 28px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-tertiary);
          font-family: monospace;
        }

        .settings-model-name {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          align-items: center;
          min-height: 32px;
          font-size: 13px;
          color: var(--color-text-primary);
        }

        .settings-model-name .settings-input {
          width: 100%;
          box-sizing: border-box;
          padding: 7px 10px;
          font-size: 13px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-primary-400);
          color: var(--color-text-primary);
        }

        .settings-model-status {
          flex: 0 0 auto;
          font-size: 11px;
          justify-self: end;
        }

        .settings-model-status-loading {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--color-text-secondary);
        }

        .settings-model-status-success {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(34, 197, 94, 0.1);
          color: var(--color-success);
          font-size: 11px;
          font-weight: 500;
        }

        .settings-model-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          justify-self: end;
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
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
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
          flex: 1 1 0;
          min-width: 0;
          width: 100%;
          padding: 10px 12px;
          font-size: 14px;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
        }

        .settings-model-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
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

        .settings-provider-row .settings-input {
          flex: 1 1 auto;
          min-width: 0;
          width: 0;
        }

        .settings-provider-row-actions:empty {
          width: 4px;
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
          grid-template-columns: minmax(0, 1fr) auto auto auto;
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
          border: none;
          border-radius: 10px;
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          flex: 0 0 auto;
          transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }

        .settings-model-icon-btn.primary {
          background: rgba(67, 110, 238, 0.12);
          color: var(--color-primary-600);
        }

        .settings-model-icon-btn.danger {
          background: rgba(239, 68, 68, 0.12);
          color: var(--color-error-600);
        }

        .settings-model-icon-btn:hover:not(:disabled) {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }

        .settings-model-icon-btn.primary:hover:not(:disabled) {
          background: rgba(67, 110, 238, 0.18);
          color: var(--color-primary-700);
        }

        .settings-model-icon-btn.danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.18);
          color: var(--color-error-700);
        }

        .settings-model-icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .settings-model-selector-bar {
            grid-template-columns: minmax(0, 1fr) auto auto auto;
          }

          .settings-model-selector-bar .settings-model-icon-btn {
            width: 32px;
            height: 32px;
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
          border: 1px solid color-mix(in srgb, var(--prompt-accent, var(--color-border)) 26%, var(--color-border));
          border-radius: 8px;
          background: var(--color-bg-primary);
          color: var(--prompt-accent, var(--color-text-secondary));
          cursor: pointer;
        }

        .settings-style-category-btn.active {
          background: color-mix(in srgb, var(--prompt-accent, var(--color-primary-600)) 22%, rgba(0, 0, 0, 0));
          border-color: color-mix(in srgb, var(--prompt-accent, var(--color-primary-600)) 62%, var(--color-primary-600));
          color: white;
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
