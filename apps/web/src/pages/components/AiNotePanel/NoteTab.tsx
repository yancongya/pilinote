import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import type { LocalFileResponse } from '../../../services/api';
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
import { aiRuntimeStateService } from '../../../services/aiRuntimeState';
import { useSettingsStore } from '../../../stores/settings';
import { MdxNoteEditor, type MdxNoteEditorMode } from '../../../components/ai/MdxNoteEditor';
import { buildPromptStyleOptions } from '../../../services/promptCatalog';
import { useToast } from '../../../components/Toast';

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

const MODEL_SELECTION_SEPARATOR = '::';

interface ModelOption {
  provider: string;
  model: string;
  label: string;
  value: string;
}

interface VersionMeta {
  hash: string;
  timestamp: number;
  filename: string;
  source: string;
  label: string;
}

function createModelValue(provider: string, model: string): string {
  return `${provider}${MODEL_SELECTION_SEPARATOR}${model}`;
}

function deriveFolderPath(filePath?: string | null): string | null {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  const separatorIndex = normalized.lastIndexOf('/');
  if (separatorIndex < 0) return null;
  return normalized.slice(0, separatorIndex);
}

function formatVersionTime(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'ai':
      return 'AI';
    case 'auto':
      return '自动';
    case 'migration':
      return '迁移';
    case 'manual':
      return '手动';
    default:
      return source;
  }
}

function estimateNoteWordCount(content: string): number {
  if (!content.trim()) return 0;

  const plainText = content
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText ? plainText.replace(/\s+/g, '').length : 0;
}

interface NoteTabProps {
  videoId: string;
  selectedSubtitleFilename?: string;
  onContentSnapshotChange?: (content: string) => void;
  fileType?: 'note' | 'source';
  analysisPipelineMode?: AiNotePipelineMode;
  readOnly?: boolean;
}

export function NoteTab({
  videoId,
  selectedSubtitleFilename,
  onContentSnapshotChange,
  fileType = 'note',
  analysisPipelineMode = 'video',
  readOnly = false,
}: NoteTabProps) {
  const { settings } = useSettingsStore();
  const runtimeState = useAiRuntimeState();
  const { showToast } = useToast();

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [formats, setFormats] = useState(DEFAULT_FORMATS);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [editorMode, setEditorMode] = useState<MdxNoteEditorMode>('preview');
  const [selectedModelValue, setSelectedModelValue] = useState('');
  const [noteFilePath, setNoteFilePath] = useState<string | null>(null);
  const [noteFolderPath, setNoteFolderPath] = useState<string | null>(null);
  const [noteRevision, setNoteRevision] = useState(0);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [currentHash, setCurrentHash] = useState('');
  const [showVersionPanel, setShowVersionPanel] = useState(false);

  const analysisAbortRef = useRef<AbortController | null>(null);
  const analysisNoteIdRef = useRef<string | null>(null);
  const originalContentRef = useRef('');
  const pipeline = useAnalysisPipeline();

  const activeProvider = settings?.llm?.provider || 'openai';
  const configuredModel = settings?.llm?.model || '';

  const styleOptions = useMemo(
    () => buildPromptStyleOptions({}, {}, settings?.ai_note?.style?.custom_styles || []),
    [settings?.ai_note?.style?.custom_styles],
  );

  const modelOptions = useMemo<ModelOption[]>(() => {
    const entries = Object.entries(runtimeState.testedModels)
    const mergedOptions = entries.flatMap(([provider, models]) =>
      models.map((model) => ({
        provider,
        model,
        value: createModelValue(provider, model),
        label: `${provider} · ${model}`,
      })),
    )

    if (mergedOptions.length > 0) {
      return mergedOptions
    }

    if (configuredModel) {
      return [{
        provider: activeProvider,
        model: configuredModel,
        value: createModelValue(activeProvider, configuredModel),
        label: `${activeProvider} · ${configuredModel}`,
      }]
    }

    return []
  }, [activeProvider, configuredModel, runtimeState.testedModels])

  const selectedModelSelection = useMemo(() => {
    if (modelOptions.length === 0) {
      if (!configuredModel) {
        return null
      }
      return {
        provider: activeProvider,
        model: configuredModel,
        value: createModelValue(activeProvider, configuredModel),
        label: `${activeProvider} · ${configuredModel}`,
      }
    }

    return modelOptions.find((option) => option.value === selectedModelValue) || modelOptions[0]
  }, [activeProvider, configuredModel, modelOptions, selectedModelValue])

  const previewFolderPath = noteFolderPath || deriveFolderPath(noteFilePath)
  const isSourceView = fileType === 'source'
  const showAdvancedControls = !isSourceView
  const timestampsEnabled = formats.includes('timestamps')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('pilinote.aiNote.enableTimestamps')
      if (raw === null) return
      const enabled = raw === '1' || raw === 'true'
      setFormats((prev) => {
        const has = prev.includes('timestamps')
        if (enabled && !has) {
          const next = [...prev]
          if (!next.includes('summary')) next.push('summary')
          next.push('timestamps')
          return next
        }
        if (!enabled && has) return prev.filter((f) => f !== 'timestamps')
        return prev
      })
    } catch {
      // ignore
    }
  }, [])

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
    if (modelOptions.length === 0) {
      setSelectedModelValue('')
      return
    }

    setSelectedModelValue((current) => {
      if (modelOptions.some((option) => option.value === current)) {
        return current
      }

      const preferred = modelOptions.find(
        (option) => option.provider === activeProvider && option.model === configuredModel,
      ) || modelOptions.find((option) => option.model === configuredModel) || modelOptions[0]

      return preferred?.value || ''
    })
  }, [activeProvider, configuredModel, modelOptions])

  useEffect(() => {
    void aiRuntimeStateService.refresh();
  }, []);

  const loadVersions = useCallback(async () => {
    if (fileType === 'source') {
      setVersions([]);
      setCurrentHash('');
      return;
    }
    try {
      const response = await apiService.getVersions(videoId, 'note');
      if (response.success && response.data) {
        setVersions(response.data.versions || []);
        setCurrentHash(response.data.current || '');
      }
    } catch (err) {
      console.error('加载笔记版本列表失败:', err);
    }
  }, [fileType, videoId]);

  const loadNote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getLocalFile(videoId, fileType) as LocalFileResponse & {
        meta?: {
          style?: string;
          formats?: string[];
        };
      };

      if (!response.success) {
        if (videoId) {
          const sourceResponse = await apiService.getLocalFile(videoId, 'source') as LocalFileResponse & {
            meta?: {
              style?: string;
              formats?: string[];
            };
          };

          if (sourceResponse.success) {
            const sourceContent = typeof sourceResponse.data === 'string' ? sourceResponse.data : '';
            setContent(sourceContent);
            originalContentRef.current = sourceContent;
            onContentSnapshotChange?.(sourceContent);
            setNoteFilePath(sourceResponse.file_path || null);
            setNoteFolderPath(sourceResponse.folder_path || deriveFolderPath(sourceResponse.file_path));
            setEditorMode('preview');
            setNoteRevision((value) => value + 1);
            setVersions([]);
            setCurrentHash('');
            return;
          }
        }

        throw new Error(response.message || (fileType === 'source' ? '加载原文失败' : '加载笔记失败'));
      }

      const loadedContent = typeof response.data === 'string' ? response.data : '';
      setContent(loadedContent);
      originalContentRef.current = loadedContent;
      onContentSnapshotChange?.(loadedContent);
      setNoteFilePath(response.file_path || null);
      setNoteFolderPath(response.folder_path || deriveFolderPath(response.file_path));
      setEditorMode('preview');
      setNoteRevision((value) => value + 1);

      if (fileType !== 'source') {
        if (response.meta?.style) setStyle(response.meta.style || DEFAULT_STYLE);
        if (response.meta?.formats && Array.isArray(response.meta.formats)) setFormats(response.meta.formats);
      }

      await loadVersions();
    } catch (err) {
      console.error('加载笔记失败:', err);
      setError('加载笔记失败');
      setContent('');
      originalContentRef.current = '';
      onContentSnapshotChange?.('');
      setNoteFilePath(null);
      setNoteFolderPath(null);
      setNoteRevision((value) => value + 1);
      setVersions([]);
      setCurrentHash('');
    } finally {
      setLoading(false);
    }
  }, [fileType, loadVersions, onContentSnapshotChange, videoId]);

  useEffect(() => {
    if (videoId) loadNote();
  }, [videoId, loadNote]);

  const saveNote = useCallback(async () => {
    if (readOnly || fileType === 'source') return;
    setIsSaving(true);
    try {
      await apiService.saveLocalFile(videoId, 'note', content);
      originalContentRef.current = content;
      setEditorMode('preview');
      setNoteRevision((value) => value + 1);
      await loadVersions();
      onContentSnapshotChange?.(content);
      showToast('笔记已保存', 'success');
    } catch (err) {
      console.error('保存笔记失败:', err);
      setError('保存失败，请重试');
      showToast('保存失败，请重试', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [content, fileType, loadVersions, readOnly, showToast, videoId]);

  const handleCancelEdit = useCallback(() => {
    setContent(originalContentRef.current);
    setEditorMode('preview');
    setNoteRevision((value) => value + 1);
    onContentSnapshotChange?.(originalContentRef.current);
  }, [onContentSnapshotChange]);

  const handleContentChange = useCallback((nextContent: string) => {
    setContent(nextContent);
    onContentSnapshotChange?.(nextContent);
  }, [onContentSnapshotChange]);

  const handleSaveManualVersion = useCallback(async () => {
    try {
      await apiService.saveVersion(videoId, 'note', content, 'manual', '手动保存');
      await loadVersions();
      showToast('笔记版本已保存', 'success');
    } catch (err) {
      console.error('手动保存笔记版本失败:', err);
      showToast('保存版本失败', 'error');
    }
  }, [content, loadVersions, showToast, videoId]);

  const handleSwitchVersion = useCallback(async (hash: string) => {
    try {
      const response = await apiService.switchVersion(videoId, 'note', hash);
      if (response.success) {
        await loadNote();
        showToast('已切换到指定版本', 'success');
      }
    } catch (err) {
      console.error('切换笔记版本失败:', err);
      showToast('切换版本失败', 'error');
    }
  }, [loadNote, showToast, videoId]);

  const handleDeleteVersion = useCallback(async (hash: string) => {
    try {
      const response = await apiService.deleteVersion(videoId, 'note', hash);
      if (response.success) {
        await loadVersions();
        showToast('已删除版本', 'success');
      }
    } catch (err) {
      console.error('删除笔记版本失败:', err);
      showToast('删除版本失败', 'error');
    }
  }, [loadVersions, showToast, videoId]);

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

    const modelSelection = selectedModelSelection;
    if (!modelSelection?.model) {
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
      if (analysisPipelineMode !== 'image_text' && !subtitleFilename) {
        try {
          const filesResponse: any = await apiService.getSubtitleFiles(videoId);
          if (filesResponse.success && filesResponse.data) {
            const srtFiles = (filesResponse.data || [])
              .map((f: any) => (typeof f === 'string' ? f : f?.name || ''))
              .filter((name: string) => name.endsWith('.srt'));
            const subtitlePriority = [
              '.zh-CN.ai.srt',
              '.ai-zh.srt',
              '.zh-CN.srt',
              '.srt',
            ];
            subtitleFilename =
              subtitlePriority
                .map((suffix) => srtFiles.find((f: string) => f.endsWith(suffix)))
                .find(Boolean) || srtFiles[0];
          }
        } catch (e) {
          console.warn('[NoteTab] Failed to get subtitle files:', e);
        }
      }

      const isReanalyze = analysisPipelineMode !== 'image_text' && !!subtitleFilename;
      pipeline.startPipeline(analysisPipelineMode, isReanalyze);
      showToast('已开始重新生成 AI 笔记', 'info');

      await aiNoteService.analyzeStream(
        '/api/note/pipeline-analyze',
        {
          video_id: videoId,
          style,
          level: detailLevel,
          formats,
          model_provider: modelSelection.provider || activeProvider,
          model_name: modelSelection.model,
          pipeline_mode: analysisPipelineMode,
          subtitle_filename: subtitleFilename || undefined,
        },
        (event) => {
          if (event.stage === 'INIT' && event.data?.note_id) {
            analysisNoteIdRef.current = event.data.note_id;
          }

          if (event.status === 'processing') {
            const processingDetail = event.data
              ? (typeof event.data === 'string'
                ? event.data
                : (event.data.summary || event.data.message || JSON.stringify(event.data)))
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

            const detailText = event.data
              ? (typeof event.data === 'string'
                ? event.data
                : (event.data.summary || event.data.message || JSON.stringify(event.data)))
              : '';
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
  }, [activeProvider, analysisPipelineMode, detailLevel, formats, isAnalyzing, loadNote, pipeline, selectedModelSelection, selectedSubtitleFilename, showToast, style, videoId]);

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

  const noteWordCount = estimateNoteWordCount(content);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <style>{scrollbarStyle}</style>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)', flexShrink: 0, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap', minWidth: 'max-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>AI 模型</span>
            <select
              value={selectedModelValue}
              onChange={(e) => setSelectedModelValue(e.target.value)}
              disabled={isAnalyzing}
              style={{ minWidth: '220px', padding: '8px 10px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px' }}
            >
              {modelOptions.length > 0 ? (
                modelOptions.map(model => <option key={model.value} value={model.value}>{model.label}</option>)
              ) : (
                <option value="">未配置模型</option>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            {(['edit', 'preview', 'split'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setEditorMode(mode)}
                disabled={isAnalyzing}
                style={{
                  padding: '8px 12px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  background: editorMode === mode ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                  color: editorMode === mode ? '#fff' : 'var(--color-text-primary)',
                  border: 'none',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                }}
                >
                  {mode === 'edit' ? '编辑' : mode === 'preview' ? '预览' : '分屏'}
                </button>
            ))}
            {editorMode === 'edit' && !isSourceView && (
              <>
                <button
                  onClick={handleCancelEdit}
                  style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  onClick={saveNote}
                  disabled={isSaving}
                  style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', background: '#22c55e', color: '#fff', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.5 : 1 }}
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
                </>
            )}
          </div>

          {!isSourceView && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>AI 模型</span>
              <select
                value={selectedModelValue}
                onChange={(e) => setSelectedModelValue(e.target.value)}
                disabled={isAnalyzing}
                style={{ minWidth: '220px', padding: '8px 10px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px' }}
              >
                {modelOptions.length > 0 ? (
                  modelOptions.map(model => <option key={model.value} value={model.value}>{model.label}</option>)
                ) : (
                  <option value="">未配置模型</option>
                )}
              </select>
            </div>
          )}

          {!isSourceView && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>笔记风格</span>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                disabled={isAnalyzing}
              style={{ minWidth: '150px', padding: '8px 10px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px' }}
                >
                  {styleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          )}

          {!isSourceView && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>详细程度</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[{ value: 'simple', label: '简约' }, { value: 'detailed', label: '详细' }].map(len => (
                <button
                  key={len.value}
                  type="button"
                  onClick={() => setDetailLevel(len.value)}
                  disabled={isAnalyzing}
                  style={{ padding: '8px 12px', borderRadius: '8px', background: detailLevel === len.value ? 'var(--color-accent)' : 'var(--color-bg-secondary)', color: detailLevel === len.value ? '#fff' : 'var(--color-text-primary)', border: 'none', cursor: 'pointer' }}
                >
                  {len.label}
                </button>
              ))}
            </div>
            </div>
          )}

          {!isSourceView && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={timestampsEnabled}
                disabled={isAnalyzing}
                onChange={(e) => {
                  const enabled = e.target.checked
                  setFormats((prev) => {
                    const has = prev.includes('timestamps')
                    if (enabled && !has) {
                      const next = [...prev]
                      if (!next.includes('summary')) next.push('summary')
                      next.push('timestamps')
                      return next
                    }
                    if (!enabled && has) return prev.filter((f) => f !== 'timestamps')
                    return prev
                  })
                  try {
                    window.localStorage.setItem('pilinote.aiNote.enableTimestamps', enabled ? '1' : '0')
                  } catch {
                    // ignore
                  }
                }}
              />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>关键点时间戳</span>
            </label>
          )}

          {showAdvancedControls && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {NOTE_FORMATS.filter(format => format.value !== 'screenshot').map(format => {
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
            </div>
          )}

          {!isSourceView && (
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flex: '0 0 auto' }}>
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
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '16px 16px 12px' }}>
            <MdxNoteEditor
              content={content}
              documentKey={`${videoId}:${noteRevision}`}
              mode={editorMode}
              onChange={handleContentChange}
              sourceFolderPath={previewFolderPath}
              className="h-full"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderTop: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
            <span>{noteWordCount.toLocaleString()} 字</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>双击内容可编辑</span>
              {showAdvancedControls && (
                <button
                  type="button"
                  onClick={() => setShowVersionPanel(!showVersionPanel)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    background: showVersionPanel ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    color: showVersionPanel ? '#fff' : 'var(--color-text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {versions.length > 0 ? `${versions.length} 个版本` : '版本'}
                </button>
              )}
            </div>
          </div>
        </div>

        {!isSourceView && showVersionPanel && (
          <div style={{
            width: '260px',
            flexShrink: 0,
            borderLeft: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>版本历史</span>
              <button
                type="button"
                onClick={handleSaveManualVersion}
                disabled={isSaving || isAnalyzing}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  cursor: isSaving || isAnalyzing ? 'not-allowed' : 'pointer',
                  opacity: isSaving || isAnalyzing ? 0.6 : 1,
                }}
              >
                保存版本
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {[...versions].reverse().map((v) => {
                const isCurrent = v.hash === currentHash;
                return (
                  <div
                    key={v.hash}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      background: isCurrent ? 'rgba(59,130,246,0.1)' : 'transparent',
                      border: isCurrent ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: isCurrent ? '#3b82f6' : 'var(--color-text-primary)' }}>
                        {formatVersionTime(v.timestamp)}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: v.source === 'ai' ? 'rgba(16,185,129,0.15)' :
                                    v.source === 'manual' ? 'rgba(59,130,246,0.15)' :
                                    v.source === 'auto' ? 'rgba(139,92,246,0.15)' :
                                    'rgba(107,114,128,0.15)',
                        color: v.source === 'ai' ? '#10b981' :
                               v.source === 'manual' ? '#3b82f6' :
                               v.source === 'auto' ? '#8b5cf6' :
                               '#6b7280',
                      }}>
                        {sourceLabel(v.source)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{v.hash}</span>
                      {isCurrent && (
                        <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 500 }}>当前</span>
                      )}
                    </div>
                    {v.label && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>{v.label}</div>
                    )}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleSwitchVersion(v.hash)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          切换
                        </button>
                      )}
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => { if (confirm('确定删除此版本？')) void handleDeleteVersion(v.hash); }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            background: 'transparent',
                            color: '#ef4444',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: 0.7,
                          }}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {versions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--color-text-tertiary)', fontSize: '12px' }}>
                  暂无版本记录
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
