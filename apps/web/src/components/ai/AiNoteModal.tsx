import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Sparkles, Loader2, Copy, Download, RotateCwc, ChevronDown } from 'lucide-react';
import { aiNoteService, NOTE_STYLES, NOTE_FORMATS, type NoteResponse } from '../../services/aiNote';
import { useToast } from '../Toast';

interface LLMProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
}

interface AiNoteModalProps {
  videoId: string;
  videoTitle: string;
  existingNote?: NoteResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (note: NoteResponse) => void;
}

type ViewState = 'config' | 'loading' | 'result';

const STORAGE_KEY_PROVIDERS = 'pilinote_llm_providers'
const STORAGE_KEY_STYLES = 'pilinote_custom_styles'

const DEFAULT_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', baseUrl: '', apiKey: '', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'claude', name: 'Claude', baseUrl: '', apiKey: '', models: ['claude-sonnet-4-20250614', 'claude-opus-4-20250514', 'claude-haiku-3-20250620'] },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: '', apiKey: '', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'qwen', name: 'Qwen', baseUrl: '', apiKey: '', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
]

export function AiNoteModal({ videoId, videoTitle, existingNote, isOpen, onClose, onComplete }: AiNoteModalProps) {
  const [viewState, setViewState] = useState<ViewState>('config');
  const [providers, setProviders] = useState<LLMProvider[]>(DEFAULT_PROVIDERS);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<NoteResponse | null>(existingNote || null);
  const { showToast } = useToast();
  
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 加载服务商和风格
  useEffect(() => {
    try {
      const savedProviders = localStorage.getItem(STORAGE_KEY_PROVIDERS)
      if (savedProviders) {
        const parsed = JSON.parse(savedProviders)
        setProviders(parsed)
        setSelectedProvider(parsed[0]?.id || 'openai')
        setSelectedModel(parsed[0]?.models[0] || '')
      }
    } catch (e) {}
  }, [])

  useEffect(() => {
    const provider = providers.find(p => p.id === selectedProvider)
    if (provider && !selectedModel) {
      setSelectedModel(provider.models[0] || '')
    }
  }, [selectedProvider])

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
            const completedNote = await aiNoteService.getNote(noteId);
            setNote(completedNote);
            setViewState('result');
            onComplete?.(completedNote);
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
  }, [stopPolling, onComplete]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    if (isOpen && existingNote) {
      setNote(existingNote);
      if (existingNote.content) setViewState('result');
    }
  }, [isOpen, existingNote]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setError(null);
    setIsAnalyzing(true);
    setViewState('loading');
    
    try {
      const response = await aiNoteService.analyze({
        video_id: videoId,
        style: selectedProvider,
        formats: ['summary'],
        model_provider: selectedProvider,
        model_name: selectedModel,
      });

      if (response.success && response.note_id) {
        startPolling(response.note_id);
      } else {
        setIsAnalyzing(false);
        setViewState('config');
        setError(response.message || '分析失败');
      }
    } catch (err) {
      setIsAnalyzing(false);
      setViewState('config');
      setError(err instanceof Error ? err.message : '分析失败');
    }
  };

  const handleCopy = async () => {
    if (!note?.content) return;
    try {
      await navigator.clipboard.writeText(note.content);
      showToast('已复制', 'success');
    } catch {
      showToast('复制失败', 'error');
    }
  };

  const handleExport = async () => {
    if (!note?.content) return;
    try {
      const blob = new Blob([note.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-note-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出', 'success');
    } catch {
      showToast('导出失败', 'error');
    }
  };

  const handleReset = () => {
    setViewState('config');
    setNote(null);
  };

  const currentProvider = providers.find(p => p.id === selectedProvider)

  return (
    <div className="ai-note-modal-overlay" onClick={onClose}>
      <div className="ai-note-modal-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-note-modal-header">
          <div className="ai-note-modal-title">
            <Sparkles size={20} />
            <span>AI 笔记</span>
          </div>
          <button className="ai-note-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Video Info */}
        <div className="ai-note-modal-video-info">
          <span>{videoTitle}</span>
        </div>

        {/* Config View */}
        {viewState === 'config' && (
          <>
            <div className="ai-note-modal-content">
              {/* 服务商选择 */}
              <div className="ai-note-select-group">
                <label>AI 服务商</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value)
                    const p = providers.find(p => p.id === e.target.value)
                    setSelectedModel(p?.models[0] || '')
                  }}
                  className="ai-note-select"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* 模型选择 */}
              <div className="ai-note-select-group">
                <label>模型</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="ai-note-select"
                >
                  {currentProvider?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 风格选择 */}
              <div className="ai-note-select-group">
                <label>笔记风格</label>
                <select
                  value={existingNote?.style || selectedProvider}
                  onChange={() => {}}
                  className="ai-note-select"
                >
                  {NOTE_STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.label} - {s.description}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error */}
            {error && <div className="ai-note-modal-error">{error}</div>}

            {/* Footer */}
            <div className="ai-note-modal-footer">
              <button onClick={handleReset} className="ai-note-modal-btn-secondary">
                <RotateCwc size={16} />
                重置
              </button>
              <button onClick={handleAnalyze} disabled={isAnalyzing} className="ai-note-modal-btn-primary">
                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAnalyzing ? '分析中...' : '开始分析'}
              </button>
            </div>
          </>
        )}

        {/* Loading View */}
        {viewState === 'loading' && (
          <div className="ai-note-modal-loading">
            <div className="ai-note-modal-loading-spinner" />
            <p>AI 正在分析中...</p>
          </div>
        )}

        {/* Result View */}
        {viewState === 'result' && note && (
          <>
            <div className="ai-note-modal-result">
              <div className="ai-note-modal-result-actions">
                <button onClick={handleCopy}><Copy size={14} />复制</button>
                <button onClick={handleExport}><Download size={14} />导出</button>
                <button onClick={handleReset}><RotateCwc size={14} />重新分析</button>
              </div>
              <div className="ai-note-modal-result-content">
                <pre>{note.content}</pre>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .ai-note-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0,0,0,0.6);
        }

        .ai-note-modal-panel {
          width: 100%;
          max-width: 400px;
          max-height: calc(100vh - 32px);
          background: var(--color-bg-primary);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .ai-note-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
        }

        .ai-note-modal-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 17px;
          font-weight: 600;
        }

        .ai-note-modal-title svg:first-child {
          color: var(--color-primary-600);
        }

        .ai-note-modal-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          border-radius: 8px;
          cursor: pointer;
        }

        .ai-note-modal-video-info {
          padding: 12px 20px;
          background: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
          font-size: 14px;
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ai-note-modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .ai-note-select-group {
          margin-bottom: 20px;
        }

        .ai-note-select-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .ai-note-select {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
        }

        .ai-note-modal-error {
          padding: 12px 20px;
          background: var(--color-error-50);
          font-size: 14px;
          color: var(--color-error-600);
        }

        .ai-note-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
        }

        .ai-note-modal-btn-secondary,
        .ai-note-modal-btn-primary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .ai-note-modal-btn-secondary {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border: none;
        }

        .ai-note-modal-btn-primary {
          background: var(--color-primary-600);
          color: white;
          border: none;
        }

        .ai-note-modal-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ai-note-modal-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }

        .ai-note-modal-loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-primary-600);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .ai-note-modal-loading p {
          font-size: 16px;
          font-weight: 500;
        }

        .ai-note-modal-result {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .ai-note-modal-result-actions {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          border-bottom: 1px solid var(--color-border);
        }

        .ai-note-modal-result-actions button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          background: var(--color-bg-secondary);
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .ai-note-modal-result-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }

        .ai-note-modal-result-content pre {
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          margin: 0;
        }
      `}</style>
    </div>
  )
}