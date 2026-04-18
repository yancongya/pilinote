import { Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';

interface AiNoteButtonProps {
  status?: 'none' | 'processing' | 'completed' | 'failed';
  onClick: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export function AiNoteButton({ status = 'none', onClick, disabled = false, style }: AiNoteButtonProps) {
  const resolvedStatus = status === 'completed' ? 'completed' : 'none'
  const title = resolvedStatus === 'completed' ? '已分析，点击查看' : '未分析，点击查看'

  return (
    <button
      type="button"
      onMouseDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`library-ai-note-btn ${resolvedStatus === 'completed' ? 'library-ai-note-btn-completed' : 'library-ai-note-btn-default'}`}
      title={title}
      aria-disabled={disabled}
      style={style}
    >
      <Sparkles size={16} className="library-ai-note-btn-icon" />
    </button>
  );
}
