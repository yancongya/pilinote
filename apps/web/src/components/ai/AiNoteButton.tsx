import { Sparkles, Loader2 } from 'lucide-react';

interface AiNoteButtonProps {
  status?: 'none' | 'processing' | 'completed' | 'failed';
  onClick: () => void;
}

export function AiNoteButton({ status = 'none', onClick }: AiNoteButtonProps) {
  if (status === 'processing') {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); }}
        className="library-ai-note-btn library-ai-note-btn-processing"
        title="分析中..."
      >
        <Loader2 size={16} className="library-ai-note-btn-icon spinning" />
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="library-ai-note-btn library-ai-note-btn-completed"
        title="已生成，点击查看"
      >
        <Sparkles size={16} className="library-ai-note-btn-icon" />
        <span className="library-ai-note-btn-text">已生成</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="library-ai-note-btn library-ai-note-btn-failed"
        title="分析失败，点击重试"
      >
        <Sparkles size={16} className="library-ai-note-btn-icon" />
        <span className="library-ai-note-btn-text">失败重试</span>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="library-ai-note-btn library-ai-note-btn-default"
      title="生成 AI 笔记"
    >
      <Sparkles size={16} className="library-ai-note-btn-icon" />
      <span className="library-ai-note-btn-text">未生成</span>
    </div>
  );
}
