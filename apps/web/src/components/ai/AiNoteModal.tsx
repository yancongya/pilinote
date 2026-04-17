import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Sparkles, FileText, Settings, Play, Check } from 'lucide-react';
import { aiNoteService, NOTE_STYLES, NOTE_FORMATS, DEFAULT_STYLE, DEFAULT_FORMATS, type NoteResponse } from '../../services/aiNote';

interface AiNoteModalProps {
  videoId: string;
  videoTitle: string;
  existingNote?: NoteResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (note: NoteResponse) => void;
}

type TabType = 'style' | 'format' | 'llm';

const LLM_PROVIDERS = [
  { label: 'OpenAI', value: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { label: 'Claude', value: 'claude', models: ['claude-sonnet-4-20250614', 'claude-opus-4-20250514', 'claude-haiku-3-20250620'] },
  { label: 'DeepSeek', value: 'deepseek', models: ['deepseek-chat', 'deepseek-coder'] },
] as const;

export function AiNoteModal({ videoId, videoTitle, existingNote, isOpen, onClose, onComplete }: AiNoteModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('style');
  const [style, setStyle] = useState(existingNote?.style || DEFAULT_STYLE);
  const [formats, setFormats] = useState<string[]>(existingNote?.formats || DEFAULT_FORMATS);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(async (noteId: string) => {
    stopPolling();
    
    pollingRef.current = setInterval(async () => {
      try {
        const statusResponse = await aiNoteService.getStatus(noteId);
        
        if (statusResponse.success) {
          
          if (statusResponse.status === 'completed') {
            stopPolling();
            setIsAnalyzing(false);
            const note = await aiNoteService.getNote(noteId);
            onComplete?.(note);
            onClose();
          } else if (statusResponse.status === 'failed') {
            stopPolling();
            setIsAnalyzing(false);
            setError(statusResponse.error || '分析失败');
          }
        }
      } catch (err) {
        console.error('轮询错误:', err);
      }
    }, 3000);
  }, [stopPolling, onComplete, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setError(null);
    setIsAnalyzing(true);
    
    try {
      const response = await aiNoteService.analyze({
        video_id: videoId,
        style,
        formats,
        model_provider: provider,
        model_name: model,
      });

      if (response.success && response.note_id) {
        startPolling(response.note_id);
      } else {
        setIsAnalyzing(false);
        setError(response.message || '分析失败');
      }
    } catch (err) {
      setIsAnalyzing(false);
      setError(err instanceof Error ? err.message : '分析失败');
    }
  };

  const toggleFormat = (format: string) => {
    setFormats(prev => 
      prev.includes(format) 
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const providerConfig = LLM_PROVIDERS.find(p => p.value === newProvider);
    if (providerConfig) {
      setModel(providerConfig.models[0]);
    }
  };

  const tabs = [
    { id: 'style' as TabType, label: '风格', icon: Sparkles },
    { id: 'format' as TabType, label: '格式', icon: FileText },
    { id: 'llm' as TabType, label: 'LLM', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-[var(--color-bg-primary)] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            AI 笔记设置
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Title */}
        <div className="px-5 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-secondary)] truncate">
            {videoTitle}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'text-[var(--color-primary-600)] border-b-2 border-[var(--color-primary-600)] bg-[var(--color-primary-50)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-5 max-h-80 overflow-y-auto">
          {/* Style Tab */}
          {activeTab === 'style' && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                选择笔记风格
              </p>
              {NOTE_STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    style === s.value
                      ? 'bg-[var(--color-primary-50)] border-2 border-[var(--color-primary-500)]'
                      : 'bg-[var(--color-bg-secondary)] border-2 border-transparent hover:border-[var(--color-primary-300)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--color-text-primary)]">{s.label}</span>
                    {style === s.value && <Check size={16} className="text-[var(--color-primary-600)]" />}
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{s.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* Format Tab */}
          {activeTab === 'format' && (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                选择输出格式
              </p>
              {NOTE_FORMATS.map(f => (
                <button
                  key={f.value}
                  onClick={() => toggleFormat(f.value)}
                  className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                    formats.includes(f.value)
                      ? 'bg-[var(--color-primary-50)] border-2 border-[var(--color-primary-500)]'
                      : 'bg-[var(--color-bg-secondary)] border-2 border-transparent hover:border-[var(--color-primary-300)]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    formats.includes(f.value)
                      ? 'bg-[var(--color-primary-500)] border-[var(--color-primary-500)]'
                      : 'border-[var(--color-border)]'
                  }`}>
                    {formats.includes(f.value) && <Check size={12} color="white" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-[var(--color-text-primary)]">{f.label}</div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{f.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* LLM Tab */}
          {activeTab === 'llm' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">LLM 提供商</p>
                <div className="flex gap-2">
                  {LLM_PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => handleProviderChange(p.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        provider === p.value
                          ? 'bg-[var(--color-primary-600)] text-white'
                          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">模型选择</p>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
                >
                  {LLM_PROVIDERS.find(p => p.value === provider)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
          >
            取消
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || formats.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Play size={16} />
                开始分析
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}