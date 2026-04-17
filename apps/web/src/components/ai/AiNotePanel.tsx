import { useState, useEffect } from 'react';
import { aiNoteService, NoteResponse, DEFAULT_STYLE, DEFAULT_FORMATS } from '../../services/aiNote';
import { useNotePolling } from '../../hooks/useNotePolling';
import { StyleSelector } from './StyleSelector';
import { FormatSelector } from './FormatSelector';
import { MarkdownViewer } from './MarkdownViewer';

interface AiNotePanelProps {
  videoId: string;
  videoTitle?: string;
}

type ViewMode = 'form' | 'result' | 'loading';

export function AiNotePanel({ videoId, videoTitle }: AiNotePanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [formats, setFormats] = useState(DEFAULT_FORMATS);
  const [note, setNote] = useState<NoteResponse | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [recommendedStyle, setRecommendedStyle] = useState<string | null>(null);
  
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

  // 检查是否已有笔记
  useEffect(() => {
    const checkExistingNote = async () => {
      setIsLoadingExisting(true);
      try {
        const lookup = await aiNoteService.lookupNoteByVideo(videoId);
        if (!lookup.success || !lookup.found || !lookup.note) {
          setNote(null);
          setNoteId(null);
          setViewMode('form');
          return;
        }

        setNote(lookup.note);
        setStyle(lookup.note.style || DEFAULT_STYLE);
        setFormats(lookup.note.formats || DEFAULT_FORMATS);

        if (lookup.note.status === 'processing' || lookup.note.status === 'pending') {
          setNoteId(lookup.note.id);
          setViewMode('loading');
        } else {
          setNoteId(null);
          setViewMode('result');
        }
      } catch (err) {
        // 无笔记，正常情况
      } finally {
        setIsLoadingExisting(false);
      }
    };
    
    if (videoId) {
      checkExistingNote();
    }
  }, [videoId]);

  const handleAnalyze = async () => {
    try {
      const response = await aiNoteService.analyze({
        video_id: videoId,
        style,
        formats,
        model_provider: 'openai',
        model_name: 'gpt-4o-mini',
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
        setStyle(data.recommended_style);
      }
    } catch (err) {
      console.error('推荐失败:', err);
    }
  };

  const handleExport = async () => {
    if (!note?.id) return;
    
    try {
      const response = await fetch(`/api/note/export/${note.id}`);
      const blob = await response.blob();
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-note-${note.id.slice(0, 8)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败:', err);
    }
  };

  const handleCopy = async () => {
    if (!note?.content) return;
    
    try {
      await navigator.clipboard.writeText(note.content);
      alert('已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  if (isLoadingExisting) {
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
            <StyleSelector value={style} onChange={setStyle} />
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
            <MarkdownViewer content={note.content || ''} />
          </div>
          
          {note.summary && (
            <div className="mt-4 p-3 bg-gray-700 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300 mb-1">AI 总结</h4>
              <p className="text-sm text-gray-400">{note.summary}</p>
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            风格: {note.style} | 模型: {note.model_name}
          </div>
        </div>
      )}
    </div>
  );
}
