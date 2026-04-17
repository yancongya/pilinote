import { Sparkles, Loader2 } from 'lucide-react';

interface AiNoteButtonProps {
  status?: 'none' | 'processing' | 'completed';
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
        title="查看笔记"
      >
        <Sparkles size={16} className="library-ai-note-btn-icon" />
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
    </div>
  );
}