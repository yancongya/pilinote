import { Sparkles, Loader2 } from 'lucide-react';
import type { CSSProperties } from 'react';

interface AiNoteButtonProps {
  status?: 'none' | 'processing' | 'completed' | 'failed';
  onClick: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export function AiNoteButton({ status = 'none', onClick, disabled = false, style }: AiNoteButtonProps) {
  if (status === 'processing') {
    return (
      <button
        type="button"
        onMouseDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); }}
        className="library-ai-note-btn library-ai-note-btn-processing"
        title="分析中..."
        aria-disabled="true"
        style={style}
      >
        <Loader2 size={16} className="library-ai-note-btn-icon spinning" />
      </button>
    );
  }

  if (status === 'completed') {
    return (
      <button
        type="button"
        onMouseDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="library-ai-note-btn library-ai-note-btn-completed"
        title="已生成，点击查看"
        style={style}
      >
        <Sparkles size={16} className="library-ai-note-btn-icon" />
        <span className="library-ai-note-btn-text">已生成</span>
      </button>
    );
  }

  if (status === 'failed') {
    return (
      <button
        type="button"
        onMouseDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="library-ai-note-btn library-ai-note-btn-failed"
        title="分析失败，点击重试"
        style={style}
      >
        <Sparkles size={16} className="library-ai-note-btn-icon" />
        <span className="library-ai-note-btn-text">失败重试</span>
      </button>
    );
  }

  return (
      <button
      type="button"
      onMouseDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="library-ai-note-btn library-ai-note-btn-default"
      title="生成 AI 笔记"
      aria-disabled={disabled}
      style={style}
    >
      <Sparkles size={16} className="library-ai-note-btn-icon" />
      <span className="library-ai-note-btn-text">未生成</span>
    </button>
  );
}
