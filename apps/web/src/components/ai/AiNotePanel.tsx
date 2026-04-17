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
        const existingNote = await aiNoteService.getNoteByVideo(videoId);
        if (existingNote.success && existingNote.content) {
          setNote(existingNote);
          setStyle(existingNote.style || DEFAULT_STYLE);
          setFormats(existingNote.formats || DEFAULT_FORMATS);
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
          
          <StyleSelector value={style} onChange={setStyle} />
          
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
            <button
              onClick={() => setViewMode('loading')}
              className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              思维导图
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