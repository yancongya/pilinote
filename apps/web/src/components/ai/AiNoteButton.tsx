import { Sparkles, Loader2 } from 'lucide-react';

interface AiNoteButtonProps {
  status?: 'none' | 'processing' | 'completed';
  onClick: () => void;
}

export function AiNoteButton({ status = 'none', onClick }: AiNoteButtonProps) {
  const baseClass = 'ai-note-btn'
  
  if (status === 'processing') {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); }}
        className={`${baseClass} ${baseClass}-processing`}
        title="分析中..."
      >
        <Loader2 size={16} className="ai-note-btn-icon spinning" />
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`${baseClass} ${baseClass}-completed`}
        title="查看笔记"
      >
        <Sparkles size={16} className="ai-note-btn-icon" />
      </div>
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`${baseClass} ${baseClass}-default`}
      title="生成 AI 笔记"
    >
      <Sparkles size={16} className="ai-note-btn-icon" />
    </div>
  );
}