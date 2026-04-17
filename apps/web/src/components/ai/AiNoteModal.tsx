import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Sparkles, Loader2, Copy, Download, RotateCcw, ChevronDown } from 'lucide-react';
import { aiNoteService, NOTE_STYLES, NOTE_FORMATS, DEFAULT_STYLE, DEFAULT_FORMATS, type NoteResponse } from '../../services/aiNote';
import { useToast } from '../Toast';

interface NoteStyle {
  value: string;
  label: string;
}

interface NoteFormat {
  value: string;
  label: string;
}

interface AiNoteModalProps {
  videoId: string;
  videoTitle: string;
  existingNote?: NoteResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (note: NoteResponse) => void;
  // 从设置中读取的默认值
  defaultStyle?: string;
  defaultFormats?: string[];
}

type ViewState = 'config' | 'loading' | 'result';

const LLM_PROVIDERS = [
  { label: 'OpenAI', value: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { label: 'Claude', value: 'claude', models: ['claude-sonnet-4-20250614', 'claude-opus-4-20250514', 'claude-haiku-3-20250620'] },
  { label: 'DeepSeek', value: 'deepseek', models: ['deepseek-chat', 'deepseek-coder'] },
] as const;

export function AiNoteModal({ videoId, videoTitle, existingNote, isOpen, onClose, onComplete, defaultStyle, defaultFormats }: AiNoteModalProps) {
  const [viewState, setViewState] = useState<ViewState>('config');
  const [style, setStyle] = useState(existingNote?.style || defaultStyle || DEFAULT_STYLE);
  const [formats, setFormats] = useState<string[]>(existingNote?.formats || defaultFormats || DEFAULT_FORMATS);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<NoteResponse | null>(existingNote || null);
  const { showToast } = useToast();
  
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
      setStyle(existingNote.style || defaultStyle || DEFAULT_STYLE);
      setFormats(existingNote.formats || defaultFormats || DEFAULT_FORMATS);
      if (existingNote.content) {
        setViewState('result');
      }
    }
  }, [isOpen, existingNote, defaultStyle, defaultFormats]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setError(null);
    setIsAnalyzing(true);
    setViewState('loading');
    
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
        setViewState('config');
        setError(response.message || '分析失败');
      }
    } catch (err) {
      setIsAnalyzing(false);
      setViewState('config');
      setError(err instanceof Error ? err.message : '分析失败');
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const providerConfig = LLM_PROVIDERS.find(p => p.value === newProvider);
    if (providerConfig) {
      setModel(providerConfig.models[0]);
    }
  };

  const handleCopy = async () => {
    if (!note?.content) return;
    try {
      await navigator.clipboard.writeText(note.content);
      showToast('已复制到剪贴板', 'success');
    } catch (err) {
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
      a.download = `ai-note-${note.id?.slice(0, 8) || 'export'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('已导出', 'success');
    } catch (err) {
      showToast('导出失败', 'error');
    }
  };

  const handleReset = () => {
    setViewState('config');
    setNote(null);
    setStyle(defaultStyle || DEFAULT_STYLE);
    setFormats(defaultFormats || DEFAULT_FORMATS);
  };

  const handleStyleChange = (value: string) => {
    const selectedStyle = NOTE_STYLES.find(s => s.value === value);
    if (selectedStyle) {
      setStyle(value);
    }
  };

  const handleFormatChange = (value: string) => {
    setFormats(prev => 
      prev.includes(value) 
        ? prev.filter(f => f !== value)
        : [...prev, value]
    );
  };

  return (
    <div className="ai-note-modal-overlay" onClick={onClose}>
      <div className="ai-note-modal-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-note-modal-header">
          <div className="ai-note-modal-title">
            <Sparkles size={20} className="ai-note-modal-icon" />
            <span>AI 笔记</span>
          </div>
          <button className="ai-note-modal-close" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        {/* Video Info */}
        <div className="ai-note-modal-video-info">
          <span className="ai-note-modal-video-title">{videoTitle}</span>
        </div>

        {/* Config View */}
        {viewState === 'config' && (
          <>
            <div className="ai-note-modal-content">
              {/* 风格下拉选择 */}
              <div className="ai-note-select-group">
                <label className="ai-note-select-label">笔记风格</label>
                <select
                  value={style}
                  onChange={(e) => handleStyleChange(e.target.value)}
                  className="ai-note-select"
                >
                  {NOTE_STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* 格式多选 */}
              <div className="ai-note-select-group">
                <label className="ai-note-select-label">输出格式</label>
                <div className="ai-note-format-chips">
                  {NOTE_FORMATS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => handleFormatChange(f.value)}
                      className={`ai-note-format-chip ${formats.includes(f.value) ? 'active' : ''}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* LLM选择 */}
              <div className="ai-note-select-group">
                <label className="ai-note-select-label">AI 模型</label>
                <div className="ai-note-provider-select">
                  <select
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="ai-note-select-half"
                  >
                    {LLM_PROVIDERS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="ai-note-select-half"
                  >
                    {LLM_PROVIDERS.find(p => p.value === provider)?.models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="ai-note-modal-error">{error}</div>
            )}

            {/* Footer */}
            <div className="ai-note-modal-footer">
              <button
                onClick={handleReset}
                className="ai-note-modal-btn-secondary"
              >
                <RotateCcw size={16} />
                重置
              </button>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || formats.length === 0}
                className="ai-note-modal-btn-primary"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    开始分析
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* Loading View */}
        {viewState === 'loading' && (
          <div className="ai-note-modal-loading">
            <div className="ai-note-modal-loading-spinner" />
            <p>AI 正在分析中...</p>
            <span className="ai-note-modal-loading-hint">请稍候</span>
          </div>
        )}

        {/* Result View */}
        {viewState === 'result' && note && (
          <>
            <div className="ai-note-modal-result">
              <div className="ai-note-modal-result-actions">
                <button onClick={handleCopy} className="ai-note-modal-result-btn">
                  <Copy size={14} />
                  复制
                </button>
                <button onClick={handleExport} className="ai-note-modal-result-btn">
                  <Download size={14} />
                  导出
                </button>
                <button onClick={handleReset} className="ai-note-modal-result-btn">
                  <RotateCcw size={14} />
                  重新分析
                </button>
              </div>
              <div className="ai-note-modal-result-content">
                <pre className="ai-note-modal-result-pre">{note.content}</pre>
              </div>
              {note.summary && (
                <div className="ai-note-modal-result-summary">
                  <strong>AI 总结</strong>
                  <p>{note.summary}</p>
                </div>
              )}
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
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }

        .ai-note-modal-panel {
          width: 100%;
          max-width: 440px;
          max-height: calc(100vh - 32px);
          background: var(--color-bg-primary);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
          flex-shrink: 0;
        }

        .ai-note-modal-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 17px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .ai-note-modal-icon {
          color: var(--color-primary-600);
        }

        .ai-note-modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-note-modal-close:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        .ai-note-modal-video-info {
          padding: 12px 20px;
          background: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }

        .ai-note-modal-video-title {
          font-size: 14px;
          color: var(--color-text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: block;
        }

        .ai-note-modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .ai-note-select-group {
          margin-bottom: 20px;
        }

        .ai-note-select-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
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
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          cursor: pointer;
        }

        .ai-note-select:focus {
          outline: none;
          border-color: var(--color-primary-600);
        }

        .ai-note-format-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ai-note-format-chip {
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 13px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-note-format-chip:hover {
          border-color: var(--color-primary-400);
          color: var(--color-text-primary);
        }

        .ai-note-format-chip.active {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
        }

        .ai-note-provider-select {
          display: flex;
          gap: 10px;
        }

        .ai-note-select-half {
          flex: 1;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          cursor: pointer;
        }

        .ai-note-select-half:focus {
          outline: none;
          border-color: var(--color-primary-600);
        }

        .ai-note-modal-error {
          padding: 12px 20px;
          background: var(--color-error-50);
          border-top: 1px solid var(--color-error-200);
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
          flex-shrink: 0;
        }

        .ai-note-modal-btn-secondary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          background: var(--color-bg-tertiary);
          border: none;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-note-modal-btn-secondary:hover {
          background: var(--color-bg-secondary);
        }

        .ai-note-modal-btn-primary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          background: var(--color-primary-600);
          border: none;
          color: white;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-note-modal-btn-primary:hover:not(:disabled) {
          background: var(--color-primary-700);
        }

        .ai-note-modal-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ai-note-modal-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
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

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .ai-note-modal-loading p {
          font-size: 16px;
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .ai-note-modal-loading-hint {
          font-size: 13px;
          color: var(--color-text-tertiary);
          margin-top: 8px;
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
          flex-shrink: 0;
        }

        .ai-note-modal-result-btn {
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
          transition: all 0.15s ease;
        }

        .ai-note-modal-result-btn:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        .ai-note-modal-result-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }

        .ai-note-modal-result-pre {
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-primary);
          white-space: pre-wrap;
          word-wrap: break-word;
          margin: 0;
        }

        .ai-note-modal-result-summary {
          padding: 12px 20px;
          background: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .ai-note-modal-result-summary strong {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          display: block;
          margin-bottom: 4px;
        }

        .ai-note-modal-result-summary p {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin: 0;
        }

        @media (min-width: 768px) {
          .ai-note-modal-panel {
            max-width: 480px;
          }

          .ai-note-modal-title {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  )
}