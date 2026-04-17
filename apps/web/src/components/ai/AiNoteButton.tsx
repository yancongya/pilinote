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
        className="ai-note-button ai-note-button-processing"
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'wait',
          border: '2px solid rgba(59, 130, 246, 0.5)',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
        }}
      >
        <Loader2 size={16} color="white" className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="ai-note-button ai-note-button-completed"
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '2px solid rgba(139, 92, 246, 0.5)',
          boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)',
        }}
      >
        <Sparkles size={16} color="white" />
      </div>
    );
  }

  // Default: not analyzed yet
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="ai-note-button ai-note-button-default"
      title="生成 AI 笔记"
      style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: 0.8,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.8)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.8';
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
      }}
    >
      <Sparkles size={16} color="white" />
    </div>
  );
}