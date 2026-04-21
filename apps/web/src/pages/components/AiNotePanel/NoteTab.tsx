import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiService } from '../../../services/api';
import { aiNoteService, AI_NOTE_TRACE_STAGE_TEMPLATES, AI_NOTE_REANALYZE_STAGE_TEMPLATES, DEFAULT_STYLE, DEFAULT_FORMATS, NOTE_FORMATS } from '../../../services/aiNote';
import type { AiTraceStep, AiNotePipelineMode } from '../../../services/aiNote';
import { useAiRuntimeState } from '../../../hooks/useAiRuntimeState';
import { useSettingsStore } from '../../../stores/settings';
import { buildPromptStyleOptions } from '../../../services/promptCatalog';

function slugify(text: string): string {
  // 提取标题部分（处理后端生成的 anchor-title-content-XXXX 格式）
  const title = text.split('-content-')[0];
  return title.toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseMarkdown(text: string, onHeadingClick?: (id: string) => void): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const id = slugify(content);

      const headingStyles: Record<number, React.CSSProperties> = {
        1: { fontSize: '28px', fontWeight: 700, color: '#fff', marginTop: '28px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' },
        2: { fontSize: '22px', fontWeight: 600, color: '#60a5fa', marginTop: '24px', marginBottom: '12px' },
        3: { fontSize: '18px', fontWeight: 600, color: '#a78bfa', marginTop: '20px', marginBottom: '8px' },
        4: { fontSize: '16px', fontWeight: 600, color: '#34d399', marginTop: '16px', marginBottom: '8px' },
        5: { fontSize: '14px', fontWeight: 600, color: '#f472b6', marginTop: '14px', marginBottom: '6px' },
        6: { fontSize: '13px', fontWeight: 600, color: '#fb923c', marginTop: '12px', marginBottom: '4px' },
      };

      const renderHeading = () => {
        const style = { ...headingStyles[level], cursor: 'pointer' as const };
        switch(level) {
          case 1: return <h1 key={`h1-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h1>;
          case 2: return <h2 key={`h2-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h2>;
          case 3: return <h3 key={`h3-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h3>;
          case 4: return <h4 key={`h4-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h4>;
          case 5: return <h5 key={`h5-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h5>;
          case 6: return <h6 key={`h6-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h6>;
          default: return <h1 key={`h1-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h1>;
        }
      };

      elements.push(renderHeading());
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.slice(2);
      elements.push(<li key={`li-${i}`} style={{ color: 'var(--color-text-primary)', marginLeft: '20px', marginBottom: '6px', listStyleType: 'disc' }}>{parseInline(text, onHeadingClick)}</li>);
      continue;
    }

    if (trimmed.match(/^(\d+)\.\s/)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(<li key={`ol-${i}`} style={{ color: 'var(--color-text-primary)', marginLeft: '20px', marginBottom: '6px', listStyleType: 'decimal' }}>{parseInline(match[2], onHeadingClick)}</li>);
        continue;
      }
    }

    if (trimmed.startsWith('> ')) {
      elements.push(<blockquote key={`bq-${i}`} style={{ borderLeft: '3px solid var(--color-accent)', paddingLeft: '16px', margin: '12px 0', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{parseInline(trimmed.slice(2), onHeadingClick)}</blockquote>);
      continue;
    }

    if (trimmed.startsWith('---')) {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />);
      continue;
    }

    elements.push(<p key={`p-${i}`} style={{ color: 'var(--color-text-primary)', marginBottom: '10px', lineHeight: 1.7 }}>{parseInline(line, onHeadingClick)}</p>);
  }

  return elements;
}

function parseInline(text: string, onHeadingClick?: (id: string) => void): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++} style={{ fontWeight: 700, color: '#fff' }}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(<em key={key++} style={{ fontStyle: 'italic' }}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      parts.push(<code key={key++} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];

      // 原片跳转链接 - 显示为特殊样式
      if (linkText.startsWith('原片 @') || linkText.startsWith('原片（')) {
        const timeMatch = linkText.match(/原片[（@]\s*(\d{2}:\d{2})/);
        const timeText = timeMatch ? timeMatch[1] : '';
        
        parts.push(
          <span
            key={key++}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            <svg style={{ width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>原片</span>
            {timeText && <span style={{ color: '#93c5fd' }}>@{timeText}</span>}
          </span>
        );
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // 锚点跳转
      if (linkUrl.startsWith('#')) {
        const anchorId = linkUrl.slice(1);
        parts.push(
          <a
            key={key++}
            href={linkUrl}
            onClick={(e) => {
              e.preventDefault();
              onHeadingClick?.(anchorId);
            }}
            style={{ color: 'var(--color-accent)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {linkText}
          </a>
        );
      } else {
        parts.push(<a key={key++} href={linkUrl} style={{ color: 'var(--color-accent)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{linkText}</a>);
      }
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    const textMatch = remaining.match(/^[^`*\[\]>_-]+/);
    if (textMatch) {
      parts.push(textMatch[0]);
      remaining = remaining.slice(textMatch[0].length);
      continue;
    }

    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return parts;
}

interface StageState {
  key: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  detail?: string;
}

function useAnalysisPipeline() {
  const [stages, setStages] = useState<StageState[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const buildStages = useCallback((pipelineMode: AiNotePipelineMode = 'video', isReanalyze = false) => {
    const templates = isReanalyze
      ? (AI_NOTE_REANALYZE_STAGE_TEMPLATES[pipelineMode] || AI_NOTE_REANALYZE_STAGE_TEMPLATES.video)
      : (AI_NOTE_TRACE_STAGE_TEMPLATES[pipelineMode] || AI_NOTE_TRACE_STAGE_TEMPLATES.video);
    return templates.map(t => ({ key: t.stage, label: t.shortLabel, status: 'pending' as const }));
  }, []);

  const applyTrace = useCallback((trace: AiTraceStep[], pipelineMode: AiNotePipelineMode = 'video', isReanalyze = false) => {
    const templates = isReanalyze
      ? (AI_NOTE_REANALYZE_STAGE_TEMPLATES[pipelineMode] || AI_NOTE_REANALYZE_STAGE_TEMPLATES.video)
      : (AI_NOTE_TRACE_STAGE_TEMPLATES[pipelineMode] || AI_NOTE_TRACE_STAGE_TEMPLATES.video);

    setStages(templates.map(t => {
      const traceItem = trace.find(tr => tr.stage === t.stage);
      return {
        key: t.stage,
        label: t.shortLabel,
        status: traceItem ? 'completed' as const : 'pending' as const,
        detail: traceItem?.summary,
      };
    }));
  }, []);

  const startPipeline = useCallback((pipelineMode: AiNotePipelineMode = 'video', isReanalyze = false) => {
    const templates = isReanalyze
      ? (AI_NOTE_REANALYZE_STAGE_TEMPLATES[pipelineMode] || AI_NOTE_REANALYZE_STAGE_TEMPLATES.video)
      : (AI_NOTE_TRACE_STAGE_TEMPLATES[pipelineMode] || AI_NOTE_TRACE_STAGE_TEMPLATES.video);
    setStages(templates.map(t => ({ key: t.stage, label: t.shortLabel, status: 'pending' as const })));
    setIsRunning(true);
  }, []);

  const updateFromTrace = useCallback((trace: AiTraceStep[], pipelineMode: AiNotePipelineMode = 'video') => {
    const templates = AI_NOTE_TRACE_STAGE_TEMPLATES[pipelineMode] || AI_NOTE_TRACE_STAGE_TEMPLATES.video;

    setStages(prev => {
      const current = prev.length > 0 ? prev : templates.map(t => ({ key: t.stage, label: t.shortLabel, status: 'pending' as const }));
      return current.map(s => {
        const traceItem = trace.find(t => t.stage === s.key);
        if (traceItem) {
          return { ...s, status: 'completed' as const, detail: traceItem.summary };
        }
        return s;
      });
    });
  }, []);

  const updateStageStatus = useCallback((stage: string, status: 'processing' | 'completed' | 'error', detail?: string) => {
    setStages(prev => {
      if (prev.length === 0) return prev;
      
      const next = prev.map(s => {
        if (s.key === stage) {
          return { ...s, status, detail: detail || s.detail };
        }
        return s;
      });
      
      // 当某个阶段完成时，自动将下一个 pending 阶段标记为 processing
      if (status === 'completed') {
        const stageIndex = next.findIndex(s => s.key === stage);
        if (stageIndex >= 0 && stageIndex < next.length - 1) {
          const nextStage = next[stageIndex + 1];
          if (nextStage.status === 'pending') {
            next[stageIndex + 1] = { ...nextStage, status: 'processing', detail: '处理中...' };
          }
        }
      }
      
      
      return next;
    });
  }, []);

  const markComplete = useCallback(() => {
    setStages(prev => prev.map(s => ({ ...s, status: 'completed' as const })));
    setIsRunning(false);
  }, []);

  const markError = useCallback((errorKey?: string) => {
    setStages(prev => prev.map(s => {
      if (errorKey && s.key === errorKey) return { ...s, status: 'error' as const };
      return s;
    }));
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setStages([]);
    setIsRunning(false);
  }, []);

  return { stages, isRunning, buildStages, applyTrace, startPipeline, updateFromTrace, updateStageStatus, markComplete, markError, reset };
}

export function NoteTab({ videoId, selectedSubtitleFilename }: { videoId: string; selectedSubtitleFilename?: string }) {
  const { settings } = useSettingsStore();
  const runtimeState = useAiRuntimeState();
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [formats, setFormats] = useState(DEFAULT_FORMATS);
  const [detailLevel, setDetailLevel] = useState('detailed'); // simple | detailed
  const contentRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pipeline = useAnalysisPipeline();

  // 复用媒体库的 LLM 配置逻辑
  const activeProvider = settings?.llm?.provider || 'openai';
  const providerModels = runtimeState.testedModels[activeProvider] || [];
  const configuredModel = settings?.llm?.model || '';
  const activeModel = providerModels.includes(configuredModel)
    ? configuredModel
    : (providerModels[0] || configuredModel);
  
  // 重新分析时的模型选择（允许用户临时更改模型）
  const [selectedModel, setSelectedModel] = useState(activeModel);
  
  // 构建风格选项（内联样式，不用Tailwind）
  const styleOptions = useMemo(
    () => buildPromptStyleOptions({}, {}, settings?.ai_note?.style?.custom_styles || []),
    [settings?.ai_note?.style?.custom_styles],
  );
  
  // 当前选中的风格
  const currentStyleInfo = styleOptions.find(s => s.value === style);
  
  // 当配置变化时更新选中的模型
  useEffect(() => {
    setSelectedModel(activeModel);
  }, [activeModel]);

  // 监听 pipeline 状态变化，用于调试
  useEffect(() => {

  }, [pipeline.stages, showModal, isAnalyzing]);

  useEffect(() => {
    if (videoId) {
      loadNote();
    }
  }, [videoId]);

  // 加载笔记时也加载保存的风格和格式
  const loadNote = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getLocalFile(videoId, 'note');
      if (response.success && response.data) {
        setContent(response.data);
        // 尝试从元数据中加载风格和格式
        if (response.meta?.style) {
          setStyle(response.meta.style || DEFAULT_STYLE);
        }
        if (response.meta?.formats && Array.isArray(response.meta.formats)) {
          setFormats(response.meta.formats);
        }
      }
    } catch (err) {
      console.error('加载笔记失败:', err);
      setError('加载笔记失败');
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    setIsSaving(true);
    try {
      await apiService.saveLocalFile(videoId, 'note', content);
      setIsEditing(false);
    } catch (err) {
      console.error('保存笔记失败:', err);
      setError('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 打开设置弹窗（不开始分析）
  const openAnalysisSettings = () => {
    
    setShowModal(true);
    setAnalysisError(null);
  };

  // 确认开始分析
  const confirmAndStartAnalysis = async () => {
    if (!selectedModel) {
      setAnalysisError('请先选择 AI 模型');
      return;
    }

    // 确保弹窗保持打开
    setShowModal(true);
    setIsAnalyzing(true);
    setAnalysisError(null);

    

    // 创建 AbortController 用于取消请求
    const abortController = new AbortController();

    try {
      // 检测字幕文件
      let subtitleFilename = selectedSubtitleFilename;
      if (!subtitleFilename) {
        try {
          const filesResponse = await apiService.getLocalFiles(videoId);
          if (filesResponse.success && filesResponse.data) {
            const srtFiles = filesResponse.data.filter((f: any) => f.endsWith('.srt'));
            const preferred = srtFiles.find((f: string) => f.includes('.ai-zh.srt') || f.includes('.zh-CN.srt'));
            subtitleFilename = preferred || srtFiles[0];
          }
        } catch (e) {
          console.warn('[NoteTab] Failed to get local files:', e);
        }
      }

      // 根据是否有字幕文件来决定用哪个阶段模板（有字幕则跳过音频和字幕生成阶段）
      const hasSubtitle = !!subtitleFilename;
      pipeline.startPipeline('video', hasSubtitle);

      

      // 使用 SSE 流式分析
      await aiNoteService.analyzeStream(
        {
          video_id: videoId,
          style,
          level: detailLevel,
          formats,
          model_provider: activeProvider,
          model_name: selectedModel,  // 使用用户选择的模型
          subtitle_filename: subtitleFilename || undefined,
        },
        (event) => {
          

          if (event.status === 'processing') {
            const processingDetail = event.data 
              ? (typeof event.data === 'string' ? event.data : JSON.stringify(event.data))
              : '处理中...';
            pipeline.updateStageStatus(event.stage, 'processing', processingDetail);
          } else if (event.status === 'completed') {
            // 标记阶段完成
            if (event.stage === 'DONE') {
              // 分析完成
              
              pipeline.markComplete();
              setIsAnalyzing(false);
              // 延迟关闭弹窗，让用户看到完成状态
              setTimeout(() => {
                setShowModal(false);
                loadNote();
              }, 1500);
            } else {
              // 普通阶段完成
              const detailText = event.data ? (typeof event.data === 'string' ? event.data : JSON.stringify(event.data)) : '';
              pipeline.updateStageStatus(event.stage, 'completed', detailText || '完成');
            }
          } else if (event.status === 'error') {
            console.error('[NoteTab] Analysis error:', event.data?.error);
            pipeline.markError();
            setAnalysisError(event.data?.error || '分析失败');
            setIsAnalyzing(false);
          }
        },
        abortController.signal
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        
        return;
      }
      console.error('[NoteTab] startAnalysis error:', err);
      pipeline.markError();
      setAnalysisError(err.message || '启动分析失败');
      setIsAnalyzing(false);
    }
  };

  const handleHeadingClick = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const scrollbarStyle = `
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <style>{scrollbarStyle}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>加载笔记中...</span>
        </div>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '24px' }}>
        <style>{scrollbarStyle}</style>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{error}</p>
        <button onClick={loadNote} style={{ padding: '8px 16px', background: 'var(--color-accent)', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>重试</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{scrollbarStyle}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg style={{ width: '20px', height: '20px', color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>AI 笔记</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {content && !isAnalyzing && !isEditing && (
            <button
              onClick={openAnalysisSettings}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                background: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新分析
            </button>
          )}
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}>取消</button>
              <button onClick={saveNote} disabled={isSaving} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: '#22c55e', color: '#fff', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.5 : 1 }}>
                {isSaving ? '保存中...' : '保存'}
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              编辑
            </button>
          )}
        </div>
      </div>

      {/* 分析进度弹窗 - 使用 Portal 渲染，避免被父组件的 overflow/position 影响 */}
      {showModal && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'none',
          }}
          onClick={(e) => {
            // 分析进行中不允许点击遮罩关闭
            if (isAnalyzing) return;
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div
            style={{
              width: 480, maxHeight: '80vh',
              background: 'var(--color-bg-primary)',
              borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>AI 笔记分析</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
                  (阶段: {pipeline.stages.length}, 分析中: {isAnalyzing ? '是' : '否'})
                </span>
              </div>
              {!isAnalyzing && (
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: 4 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* 进度流水线 */}
            {pipeline.stages.length > 0 && (
              <div style={{ padding: '20px 20px 12px', flexShrink: 0 }}>
                {pipeline.stages.map((stage, i) => (
                  <div key={stage.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* 左侧图标+连线 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                        {stage.status === 'completed' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : stage.status === 'processing' ? (
                          <div style={{ width: 16, height: 16, border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        ) : stage.status === 'error' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : (
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--color-text-tertiary)' }} />
                        )}
                      </div>
                      {i < pipeline.stages.length - 1 && (
                        <div style={{
                          width: 2, height: 28,
                          background: stage.status === 'completed' ? '#22c55e' : 'var(--color-border)',
                          borderRadius: 1,
                        }} />
                      )}
                    </div>

                    {/* 右侧内容 */}
                    <div style={{ flex: 1, paddingBottom: i < pipeline.stages.length - 1 ? 8 : 0, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: stage.status === 'pending' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', marginBottom: 2 }}>
                        {stage.label}
                        {stage.status === 'processing' && <span style={{ color: 'var(--color-accent)', marginLeft: 6 }}>分析中...</span>}
                      </div>
                      {stage.detail && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                          {stage.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* 错误显示 */}
                {analysisError && (
                  <div style={{ marginTop: 12, fontSize: 13, color: '#ef4444', padding: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
                    {analysisError}
                  </div>
                )}
              </div>
            )}

            {/* 未开始分析时显示设置和确认按钮 */}
            {!isAnalyzing && pipeline.stages.length === 0 && (
              <div style={{ padding: '16px 20px 20px' }}>
                {/* 模型选择 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    AI 模型
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    {providerModels.length > 0 ? (
                      providerModels.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))
                    ) : (
                      <option value={activeModel}>{activeModel || '未配置模型'}</option>
                    )}
                  </select>
                </div>

                {/* 笔记风格选择 - 下拉菜单 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    笔记风格
                  </label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {styleOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                    {currentStyleInfo?.description || ''}
                  </p>
                </div>

                {/* 详细/简约程度 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    详细程度
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { value: 'simple', label: '简约' },
                      { value: 'detailed', label: '详细' },
                    ].map(len => (
                      <button
                        key={len.value}
                        type="button"
                        onClick={() => setDetailLevel(len.value)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: detailLevel === len.value ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                          color: detailLevel === len.value ? '#fff' : 'var(--color-text-primary)',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {len.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 输出格式选择 - 内联样式 */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ color: 'var(--color-text-secondary)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    输出格式
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {NOTE_FORMATS.map(format => (
                      <button
                        key={format.value}
                        type="button"
                        onClick={() => {
                          if (formats.includes(format.value)) {
                            setFormats(formats.filter(f => f !== format.value));
                          } else {
                            setFormats([...formats, format.value]);
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          background: formats.includes(format.value) ? '#22c55e' : 'var(--color-bg-secondary)',
                          color: formats.includes(format.value) ? '#fff' : 'var(--color-text-primary)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {format.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 分析进行中显示当前配置（只读） */}
            {isAnalyzing && (
              <div style={{ padding: '12px 20px', opacity: 0.7, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  当前配置：
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', lineHeight: 1.8 }}>
                  <div>模型：{activeProvider} / {selectedModel}</div>
                  <div>风格：{style}</div>
                  <div>格式：{formats.join(', ') || '无'}</div>
                </div>
              </div>
            )}

            {/* 底部按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
              {!isAnalyzing && pipeline.stages.length === 0 && (
                <>
                  <button
                    onClick={() => setShowModal(false)}
                    style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmAndStartAnalysis}
                    style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                  >
                    开始分析
                  </button>
                </>
              )}
              {isAnalyzing && (
                <button
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
                >
                  取消
                </button>
              )}
              {pipeline.stages.length > 0 && !isAnalyzing && pipeline.stages.every(s => s.status === 'completed') && (
                <button
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  查看笔记
                </button>
              )}
              {pipeline.stages.length > 0 && !isAnalyzing && pipeline.stages.some(s => s.status === 'error') && (
                <button
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: 'none', cursor: 'pointer' }}
                >
                  关闭
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      <div
        ref={contentRef}
        onDoubleClick={handleDoubleClick}
        style={{ flex: 1, overflow: 'auto', padding: '16px', cursor: isEditing ? 'text' : 'pointer' }}
      >
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              padding: '16px',
              fontSize: '14px',
              fontFamily: 'monospace',
              borderRadius: '8px',
              border: 'none',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.6,
            }}
          />
        ) : (
          // 不管content是否为空，都显示编辑区域，让用户可以直接编辑或生成
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {isEditing || !content ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={content ? '' : '暂无笔记，点击开始编辑或点击上方"AI 生成笔记"按钮生成'}
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: content ? '200px' : '150px',
                  background: 'var(--color-bg-secondary)',
                  color: content ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  padding: '16px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  borderRadius: '8px',
                  border: 'none',
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.6,
                }}
              />
            ) : (
              <div style={{ maxWidth: '800px' }}>
                {parseMarkdown(content, handleHeadingClick)}
              </div>
            )}
            
            {/* 空内容时显示生成按钮（不在modal里，在主内容区域） */}
            {(!content || !isEditing) && !isAnalyzing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                <button 
                  onClick={openAnalysisSettings} 
                  style={{ 
                    padding: '10px 20px', 
                    background: 'var(--color-accent)', 
                    color: '#fff', 
                    borderRadius: '8px', 
                    border: 'none', 
                    cursor: 'pointer',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.385-1.736-1.04-2.329l.548-.547z" />
                  </svg>
                  AI 生成笔记
                </button>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
                  {!content ? '暂无笔记，点击生成或直接在上方编辑' : '双击内容区域可编辑'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {!isEditing && content && !isAnalyzing && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          <span>{content.length} 字符</span>
          <span>双击可编辑</span>
        </div>
      )}
    </div>
  );
}
