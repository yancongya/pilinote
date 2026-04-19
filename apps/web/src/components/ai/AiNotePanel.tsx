import { useState, useEffect } from 'react';
import { aiNoteService, NoteResponse, DEFAULT_STYLE, DEFAULT_FORMATS } from '../../services/aiNote';
import { useNotePolling } from '../../hooks/useNotePolling';
import { StyleSelector } from './StyleSelector';
import { FormatSelector } from './FormatSelector';
import { useAiNoteLookup } from '../../hooks/useAiNoteLookup';
import { localAsrModelService } from '../../services/localAsrModels';
import { useToast } from '../Toast';
import { useSettingsStore } from '../../stores/settings';
import { normalizePromptStyleValue } from '../../services/promptCatalog';
import { useAiRuntimeState } from '../../hooks/useAiRuntimeState';

interface AiNotePanelProps {
  videoId: string;
  videoTitle?: string;
}

type ViewMode = 'form' | 'result' | 'loading';

export function AiNotePanel({ videoId, videoTitle }: AiNotePanelProps) {
  const { settings } = useSettingsStore();
  const runtimeState = useAiRuntimeState();
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [formats, setFormats] = useState(DEFAULT_FORMATS);
  const [note, setNote] = useState<NoteResponse | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [recommendedStyle, setRecommendedStyle] = useState<string | null>(null);
  const [localAsrReady, setLocalAsrReady] = useState(true);
  const lookup = useAiNoteLookup(videoId);
  const { showToast } = useToast();
  const activeProvider = settings?.llm?.provider || 'openai';
  const providerModels = runtimeState.testedModels[activeProvider] || [];
  const configuredModel = settings?.llm?.model || '';
  const activeModel = providerModels.includes(configuredModel)
    ? configuredModel
    : (providerModels[0] || configuredModel);
  const generatedMarkdownPath = note?.generated_markdown_path || note?.meta?.generated_markdown_path || '';
  
  const { status, progress, error, startPolling } = useNotePolling({
    noteId,
    onStatusChange: (s: string) => {
      if (s === 'processing') setViewMode('loading');
    },
    onComplete: (n: NoteResponse) => {
      setNote(n);
      setViewMode('result');
    },
    onError: (e: string) => {
      console.error('分析失败:', e);
      setViewMode('form');
    },
  });

  useEffect(() => {
    if (!lookup.note) {
      setNote(null)
      setNoteId(null)
      setViewMode('form')
      return
    }

    setNote(lookup.note)
    setStyle(normalizePromptStyleValue(lookup.note.style) || DEFAULT_STYLE)
    setFormats(lookup.note.formats || DEFAULT_FORMATS)

    if (lookup.note.status === 'processing' || lookup.note.status === 'pending') {
      setNoteId(lookup.note.id)
      setViewMode('loading')
    } else {
      setNoteId(null)
      setViewMode('result')
    }
  }, [lookup.note])

  useEffect(() => {
    let cancelled = false
    localAsrModelService.checkReady().then(result => {
      if (!cancelled) setLocalAsrReady(result.ready)
    }).catch(() => {
      if (!cancelled) setLocalAsrReady(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAnalyze = async () => {
    if (!localAsrReady) {
      showToast('请先在 AI 笔记设置中下载并启用本地 ASR 模型', 'warning')
      return
    }
    if (!activeModel) {
      showToast('请先在 AI 笔记设置中测试并保存该服务商的模型', 'warning')
      return
    }
    try {
      const response = await aiNoteService.analyze({
        video_id: videoId,
        style,
        formats,
        model_provider: activeProvider,
        model_name: activeModel,
      });
      
      if (response.success && response.note_id) {
        setNoteId(response.note_id);
        setViewMode('loading');
        startPolling(response.note_id);
      }
    } catch (err) {
      console.error('触发分析失败:', err);
    }
  };

  const handleAutoRecommend = async () => {
    if (!videoTitle) return;
    
    try {
      const response = await fetch(
        `/api/note/recommend-style?title=${encodeURIComponent(videoTitle)}`
      );
      const data = await response.json();
      
      if (data.success && data.recommended_style) {
        setRecommendedStyle(data.recommended_style);
        setStyle(normalizePromptStyleValue(data.recommended_style) || DEFAULT_STYLE);
      }
    } catch (err) {
      console.error('推荐失败:', err);
    }
  };

  const handleExport = async () => {
    if (!generatedMarkdownPath) {
      showToast('没有可导出的本地 Markdown 路径', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedMarkdownPath);
      showToast('已复制本地 Markdown 路径', 'success');
    } catch (err) {
      console.error('复制路径失败:', err);
    }
  };

  const handleCopy = async () => {
    if (!generatedMarkdownPath) {
      showToast('没有可复制的本地 Markdown 路径', 'warning');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(generatedMarkdownPath);
      showToast('已复制本地 Markdown 路径', 'success');
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  if (lookup.isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">AI 笔记</h3>
        {note && viewMode === 'result' && (
          <button
            onClick={() => setViewMode('form')}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            重新分析
          </button>
        )}
      </div>

      {viewMode === 'form' && (
        <div className="space-y-4">
          {videoTitle && (
            <p className="text-sm text-gray-400">视频: {videoTitle}</p>
          )}
          
          <div className="flex items-center gap-2">
            <StyleSelector
              value={style}
              onChange={setStyle}
              currentTemplates={{}}
              defaultTemplates={{}}
              customStyles={settings?.ai_note?.style?.custom_styles || []}
            />
            <button
              onClick={handleAutoRecommend}
              className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
            >
              智能推荐
            </button>
          </div>
          
          {recommendedStyle && (
            <p className="text-xs text-green-400">
              推荐风格: {recommendedStyle}
            </p>
          )}
          
          <FormatSelector value={formats} onChange={setFormats} />
          
          <button
            onClick={handleAnalyze}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            开始 AI 分析
          </button>
        </div>
      )}

      {viewMode === 'loading' && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-300">AI 正在分析中...</p>
          <p className="text-sm text-gray-500 mt-2">
            状态: {status} {progress ? `(${Math.round(progress)}%)` : ''}
          </p>
          {error && (
            <p className="text-sm text-red-400 mt-2">错误: {error}</p>
          )}
        </div>
      )}

      {viewMode === 'result' && note && (
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-gray-700 pb-2">
            <button
              onClick={() => setViewMode('result')}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white"
            >
              笔记
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              复制
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              导出
            </button>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-300">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">本地 Markdown 路径</div>
              <div className="break-all">{generatedMarkdownPath || '暂无路径'}</div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            风格: {note.style} | 模型: {note.model_name}
          </div>
        </div>
      )}
    </div>
  );
}
