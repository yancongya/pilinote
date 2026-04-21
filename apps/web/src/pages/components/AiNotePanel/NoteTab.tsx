import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import {
  aiNoteService,
  AI_NOTE_REANALYZE_STAGE_TEMPLATES,
  AI_NOTE_TRACE_STAGE_TEMPLATES,
  DEFAULT_FORMATS,
  DEFAULT_STYLE,
  NOTE_FORMATS,
} from '../../../services/aiNote';
import type { AiNotePipelineMode } from '../../../services/aiNote';
import { useAiRuntimeState } from '../../../hooks/useAiRuntimeState';
import { useSettingsStore } from '../../../stores/settings';
import { buildPromptStyleOptions } from '../../../services/promptCatalog';
import { useToast } from '../../../components/Toast';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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
          </a>,
        );
      } else {
        parts.push(
          <a key={key++} href={linkUrl} style={{ color: 'var(--color-accent)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">
            {linkText}
          </a>,
        );
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

      const style = { ...headingStyles[level], cursor: 'pointer' as const };
      const headingProps = {
        key: `h${level}-${i}`,
        id,
        style,
        onClick: () => onHeadingClick?.(id),
        children: parseInline(content, onHeadingClick),
      };

      switch (level) {
        case 1: elements.push(<h1 {...headingProps} />); break;
        case 2: elements.push(<h2 {...headingProps} />); break;
        case 3: elements.push(<h3 {...headingProps} />); break;
        case 4: elements.push(<h4 {...headingProps} />); break;
        case 5: elements.push(<h5 {...headingProps} />); break;
        case 6: elements.push(<h6 {...headingProps} />); break;
        default: elements.push(<h1 {...headingProps} />); break;
      }
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.slice(2);
      elements.push(<li key={`li-${i}`} style={{ color: 'var(--color-text-primary)', marginLeft: '20px', marginBottom: '6px', listStyleType: 'disc' }}>{parseInline(text, onHeadingClick)}</li>);
      continue;
    }

    if (/^(\d+)\.\s/.test(trimmed)) {
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

  const startPipeline = useCallback((pipelineMode: AiNotePipelineMode = 'video', isReanalyze = false) => {
    setStages(buildStages(pipelineMode, isReanalyze));
    setIsRunning(true);
  }, [buildStages]);

  const updateStageStatus = useCallback((stage: string, status: 'processing' | 'completed' | 'error', detail?: string) => {
    setStages(prev => {
      if (prev.length === 0) return prev;
      const next = prev.map(s => (s.key === stage ? { ...s, status, detail: detail || s.detail } : s));
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

  return { stages, isRunning, startPipeline, updateStageStatus, markComplete, markError, reset };
}

export function NoteTab({ videoId, selectedSubtitleFilename }: { videoId: string; selectedSubtitleFilename?: string }) {
  const { settings } = useSettingsStore();
  const runtimeState = useAiRuntimeState();
  const { showToast } = useToast();

  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [formats, setFormats] = useState(DEFAULT_FORMATS);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [selectedModel, setSelectedModel] = useState('');

  const analysisAbortRef = useRef<AbortController | null>(null);
  const analysisNoteIdRef = useRef<string | null>(null);
  const pipeline = useAnalysisPipeline();

  const activeProvider = settings?.llm?.provider || 'openai';
  const providerModels = runtimeState.testedModels[activeProvider] || [];
  const configuredModel = settings?.llm?.model || '';
  const activeModel = providerModels.includes(configuredModel) ? configuredModel : (providerModels[0] || configuredModel);

  const styleOptions = useMemo(
    () => buildPromptStyleOptions({}, {}, settings?.ai_note?.style?.custom_styles || []),
    [settings?.ai_note?.style?.custom_styles],
  );

  const stageToastLabels: Record<string, string> = {
    'video.AUDIO.FETCH': '音频读取完成',
    'video.SUBTITLE.GENERATE': '字幕生成完成',
    'video.NFO.READ': 'NFO 读取完成',
    'video.PROMPT.BUILD': 'Prompt 构建完成',
    'video.LLM.ANALYZE': 'AI 分析完成',
    'video.CONTENT.GENERATE': '笔记生成完成',
    'series.NFO.READ': 'NFO 读取完成',
    'series.PROMPT.BUILD': 'Prompt 构建完成',
    'series.LLM.ANALYZE': 'AI 分析完成',
    'series.CONTENT.GENERATE': '笔记生成完成',
    'image_text.NFO.READ': '读取完成',
    'image_text.PROMPT.BUILD': 'Prompt 构建完成',
    'image_text.LLM.ANALYZE': 'AI 分析完成',
    'image_text.CONTENT.GENERATE': '笔记生成完成',
  };

  useEffect(() => {
    setSelectedModel(activeModel);
  }, [activeModel]);

  const loadNote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: any = await apiService.getLocalFile(videoId, 'note');
      if (response.success && response.data) {
        setContent(response.data);
        if (response.meta?.style) setStyle(response.meta.style || DEFAULT_STYLE);
        if (response.meta?.formats && Array.isArray(response.meta.formats)) setFormats(response.meta.formats);
      }
    } catch (err) {
      console.error('加载笔记失败:', err);
      setError('加载笔记失败');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    if (videoId) loadNote();
  }, [videoId, loadNote]);

  const saveNote = useCallback(async () => {
    setIsSaving(true);
    try {
      await apiService.saveLocalFile(videoId, 'note', content);
      setIsEditing(false);
      showToast('笔记已保存', 'success');
    } catch (err) {
      console.error('保存笔记失败:', err);
      setError('保存失败，请重试');
      showToast('保存失败，请重试', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [content, showToast, videoId]);

  const handleHeadingClick = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleStopAnalysis = useCallback(async () => {
    analysisAbortRef.current?.abort();
    const noteId = analysisNoteIdRef.current;
    if (noteId) {
      try {
        await aiNoteService.cancelNote(noteId);
        showToast('已取消 AI 笔记任务', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : '取消失败', 'error');
      }
    } else {
      showToast('已停止当前请求', 'info');
    }
    setIsAnalyzing(false);
    analysisAbortRef.current = null;
  }, [showToast]);

  const startAnalyze = useCallback(async () => {
    if (isAnalyzing) return;
    if (!selectedModel) {
      showToast('请先选择 AI 模型', 'warning');
      return;
    }

    setIsAnalyzing(true);
    analysisNoteIdRef.current = null;
    analysisAbortRef.current?.abort();
    const abortController = new AbortController();
    analysisAbortRef.current = abortController;

    try {
      let subtitleFilename = selectedSubtitleFilename;
      if (!subtitleFilename) {
        try {
          const filesResponse: any = await apiService.getSubtitleFiles(videoId);
          if (filesResponse.success && filesResponse.data) {
            const srtFiles = (filesResponse.data || [])
              .map((f: any) => (typeof f === 'string' ? f : f?.name || ''))
              .filter((name: string) => name.endsWith('.srt'));
            const preferred = srtFiles.find((f: string) => f.includes('.ai-zh.srt') || f.includes('.zh-CN.srt'));
            subtitleFilename = preferred || srtFiles[0];
          }
        } catch (e) {
          console.warn('[NoteTab] Failed to get subtitle files:', e);
        }
      }

      const hasSubtitle = !!subtitleFilename;
      pipeline.startPipeline('video', hasSubtitle);
      showToast('已开始重新生成 AI 笔记', 'info');

      await aiNoteService.analyzeStream(
        {
          video_id: videoId,
          style,
          level: detailLevel,
          formats,
          model_provider: activeProvider,
          model_name: selectedModel,
          subtitle_filename: subtitleFilename || undefined,
        },
        (event) => {
          if (event.stage === 'INIT' && event.data?.note_id) {
            analysisNoteIdRef.current = event.data.note_id;
          }

          if (event.status === 'processing') {
            const processingDetail = event.data
              ? (typeof event.data === 'string' ? event.data : JSON.stringify(event.data))
              : '处理中...';
            pipeline.updateStageStatus(event.stage, 'processing', processingDetail);
            return;
          }

          if (event.status === 'completed') {
            if (event.stage === 'DONE') {
              pipeline.markComplete();
              setIsAnalyzing(false);
              analysisAbortRef.current = null;
              analysisNoteIdRef.current = null;
              showToast('AI 笔记重新生成完成', 'success');
              void loadNote();
              return;
            }

            const detailText = event.data ? (typeof event.data === 'string' ? event.data : JSON.stringify(event.data)) : '';
            pipeline.updateStageStatus(event.stage, 'completed', detailText || '完成');
            const toastLabel = stageToastLabels[event.stage];
            if (toastLabel) showToast(toastLabel, 'success');
            return;
          }

          if (event.status === 'error') {
            console.error('[NoteTab] Analysis error:', event.data?.error);
            pipeline.markError();
            const message = event.data?.error || '分析失败';
            setIsAnalyzing(false);
            analysisAbortRef.current = null;
            analysisNoteIdRef.current = null;
            showToast(message, 'error');
          }
        },
        abortController.signal,
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsAnalyzing(false);
        analysisAbortRef.current = null;
        analysisNoteIdRef.current = null;
        showToast('已取消 AI 笔记重新生成', 'info');
        return;
      }
      console.error('[NoteTab] startAnalyze error:', err);
      pipeline.markError();
      setIsAnalyzing(false);
      analysisAbortRef.current = null;
      analysisNoteIdRef.current = null;
      showToast(err.message || '启动分析失败', 'error');
    }
  }, [activeProvider, detailLevel, formats, isAnalyzing, loadNote, pipeline, selectedModel, selectedSubtitleFilename, showToast, style, videoId]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort();
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <style>{scrollbarStyle}</style>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '12px', minWidth: '180px', flex: '1 1 180px' }}>
            AI 模型
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isAnalyzing}
              style={{ padding: '8px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px' }}
            >
              {providerModels.length > 0 ? (
                providerModels.map(model => <option key={model} value={model}>{model}</option>)
              ) : (
                <option value={activeModel}>{activeModel || '未配置模型'}</option>
              )}
            </select>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}>取消</button>
                <button onClick={saveNote} disabled={isSaving} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: '#22c55e', color: '#fff', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.5 : 1 }}>
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                编辑
              </button>
            )}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '12px', minWidth: '180px', flex: '1 1 180px' }}>
            笔记风格
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              disabled={isAnalyzing}
              style={{ padding: '8px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px' }}
            >
              {styleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '12px', minWidth: '168px' }}>
            详细程度
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ value: 'simple', label: '简约' }, { value: 'detailed', label: '详细' }].map(len => (
                <button
                  key={len.value}
                  type="button"
                  onClick={() => setDetailLevel(len.value)}
                  disabled={isAnalyzing}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', background: detailLevel === len.value ? 'var(--color-accent)' : 'var(--color-bg-secondary)', color: detailLevel === len.value ? '#fff' : 'var(--color-text-primary)', border: 'none', cursor: 'pointer' }}
                >
                  {len.label}
                </button>
              ))}
            </div>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '12px', minWidth: '260px', flex: '2 1 260px' }}>
            高级设置
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {NOTE_FORMATS.map(format => {
                const active = formats.includes(format.value);
                return (
                  <button
                    key={format.value}
                    type="button"
                    onClick={() => {
                      if (isAnalyzing) return;
                      setFormats(prev => prev.includes(format.value) ? prev.filter(f => f !== format.value) : [...prev, format.value]);
                    }}
                    style={{ padding: '8px 12px', borderRadius: '9999px', background: active ? '#22c55e' : 'var(--color-bg-secondary)', color: active ? '#fff' : 'var(--color-text-primary)', border: 'none', cursor: 'pointer' }}
                  >
                    {format.label}
                  </button>
                );
              })}
            </div>
          </label>

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexShrink: 0 }}>
            <button
              type="button"
              onClick={startAnalyze}
              disabled={isAnalyzing}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: isAnalyzing ? 'not-allowed' : 'pointer', opacity: isAnalyzing ? 0.6 : 1 }}
            >
              {isAnalyzing ? '重新生成中...' : '重新生成'}
            </button>
            <button
              type="button"
              onClick={handleStopAnalysis}
              disabled={!isAnalyzing}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: 'none', cursor: !isAnalyzing ? 'not-allowed' : 'pointer', opacity: !isAnalyzing ? 0.6 : 1 }}
            >
              停止
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px', cursor: isEditing ? 'text' : 'default' }}>
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              minHeight: '100%',
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
        ) : content ? (
          <div style={{ maxWidth: '800px' }} onDoubleClick={handleDoubleClick}>
            {parseMarkdown(content, handleHeadingClick)}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
            暂无笔记，点击上方重新生成按钮创建笔记
          </div>
        )}
      </div>
    </div>
  );
}
