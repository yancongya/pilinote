import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Sparkles, FileText, Settings, Play, Check, Loader2, Copy, Download, RotateCcw } from 'lucide-react';
import { aiNoteService, NOTE_STYLES, NOTE_FORMATS, DEFAULT_STYLE, DEFAULT_FORMATS, type NoteResponse } from '../../services/aiNote';
import { useToast } from '../Toast';

interface AiNoteModalProps {
  videoId: string;
  videoTitle: string;
  existingNote?: NoteResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (note: NoteResponse) => void;
}

type ViewState = 'config' | 'loading' | 'result';

const LLM_PROVIDERS = [
  { label: 'OpenAI', value: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { label: 'Claude', value: 'claude', models: ['claude-sonnet-4-20250614', 'claude-opus-4-20250514', 'claude-haiku-3-20250620'] },
  { label: 'DeepSeek', value: 'deepseek', models: ['deepseek-chat', 'deepseek-coder'] },
] as const;

export function AiNoteModal({ videoId, videoTitle, existingNote, isOpen, onClose, onComplete }: AiNoteModalProps) {
  const [viewState, setViewState] = useState<ViewState>('config');
  const [style, setStyle] = useState(existingNote?.style || DEFAULT_STYLE);
  const [formats, setFormats] = useState<string[]>(existingNote?.formats || DEFAULT_FORMATS);
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
      setStyle(existingNote.style || DEFAULT_STYLE);
      setFormats(existingNote.formats || DEFAULT_FORMATS);
      if (existingNote.content) {
        setViewState('result');
      }
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
    setStyle(DEFAULT_STYLE);
    setFormats(DEFAULT_FORMATS);
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
              {/* Style Section */}
              <div className="ai-note-modal-section">
                <div className="ai-note-modal-section-title">
                  <Sparkles size={16} />
                  <span>笔记风格</span>
                </div>
                <div className="ai-note-style-list">
                  {NOTE_STYLES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={`ai-note-style-item ${style === s.value ? 'active' : ''}`}
                    >
                      <div className="ai-note-style-item-header">
                        <span>{s.label}</span>
                        {style === s.value && <Check size={14} />}
                      </div>
                      <p className="ai-note-style-item-desc">{s.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Section */}
              <div className="ai-note-modal-section">
                <div className="ai-note-modal-section-title">
                  <FileText size={16} />
                  <span>输出格式</span>
                </div>
                <div className="ai-note-format-list">
                  {NOTE_FORMATS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => toggleFormat(f.value)}
                      className={`ai-note-format-item ${formats.includes(f.value) ? 'active' : ''}`}
                    >
                      <div className="ai-note-format-checkbox">
                        {formats.includes(f.value) && <Check size={12} />}
                      </div>
                      <div className="ai-note-format-info">
                        <span>{f.label}</span>
                        <p>{f.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* LLM Section */}
              <div className="ai-note-modal-section">
                <div className="ai-note-modal-section-title">
                  <Settings size={16} />
                  <span>LLM 模型</span>
                </div>
                <div className="ai-note-provider-list">
                  {LLM_PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => handleProviderChange(p.value)}
                      className={`ai-note-provider-btn ${provider === p.value ? 'active' : ''}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="ai-note-model-select"
                >
                  {LLM_PROVIDERS.find(p => p.value === provider)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
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
                    <Play size={16} />
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
                  ��出
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
          max-width: 480px;
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
          padding: 16px 20px;
        }

        .ai-note-modal-section {
          margin-bottom: 20px;
        }

        .ai-note-modal-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 12px;
        }

        .ai-note-style-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ai-note-style-item {
          padding: 12px;
          border-radius: 10px;
          background: var(--color-bg-secondary);
          border: 2px solid transparent;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-note-style-item:hover {
          border-color: var(--color-primary-300);
        }

        .ai-note-style-item.active {
          background: var(--color-primary-50);
          border-color: var(--color-primary-500);
        }

        .ai-note-style-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .ai-note-style-item-desc {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin-top: 4px;
        }

        .ai-note-format-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ai-note-format-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          border-radius: 10px;
          background: var(--color-bg-secondary);
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .ai-note-format-item:hover {
          border-color: var(--color-primary-300);
        }

        .ai-note-format-item.active {
          background: var(--color-primary-50);
          border-color: var(--color-primary-500);
        }

        .ai-note-format-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .ai-note-format-item.active .ai-note-format-checkbox {
          background: var(--color-primary-500);
          border-color: var(--color-primary-500);
          color: white;
        }

        .ai-note-format-info span {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
          display: block;
        }

        .ai-note-format-info p {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin-top: 2px;
        }

        .ai-note-provider-list {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .ai-note-provider-btn {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          background: var(--color-bg-secondary);
          border: none;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-note-provider-btn:hover {
          background: var(--color-bg-tertiary);
        }

        .ai-note-provider-btn.active {
          background: var(--color-primary-600);
          color: white;
        }

        .ai-note-model-select {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
        }

        .ai-note-model-select:focus {
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

        /* Desktop */
        @media (min-width: 768px) {
          .ai-note-modal-panel {
            max-width: 560px;
          }

          .ai-note-modal-title {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  )
}