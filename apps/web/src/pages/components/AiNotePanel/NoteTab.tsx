import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../../../services/api';

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseMarkdown(text: string, onHeadingClick?: (id: string) => void): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }
    
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const id = slugify(content);
      
      const headingStyles: Record<number, React.CSSProperties> = {
        1: { fontSize: '28px', fontWeight: 700, color: '#fff', marginTop: '28px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' },
        2: { fontSize: '22px', fontWeight: 600, color: '#60a5fa', marginTop: '24px', marginBottom: '12px' },
        3: { fontSize: '18px', fontWeight: 600, color: '#a78bfa', marginTop: '20px', marginBottom: '8px' },
        4: { fontSize: '16px', fontWeight: 600, color: '#34d399', marginTop: '16px', marginBottom: '8px' },
        5: { fontSize: '14px', fontWeight: 600, color: '#f472b6', marginTop: '14px', marginBottom: '6px' },
        6: { fontSize: '13px', fontWeight: 600, color: '#fb923c', marginTop: '12px', marginBottom: '4px' },
      };
      
      const renderHeading = () => {
        const style = { ...headingStyles[level], cursor: 'pointer' as const };
        switch(level) {
          case 1: return <h1 key={`h1-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h1>;
          case 2: return <h2 key={`h2-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h2>;
          case 3: return <h3 key={`h3-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h3>;
          case 4: return <h4 key={`h4-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h4>;
          case 5: return <h5 key={`h5-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h5>;
          case 6: return <h6 key={`h6-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h6>;
          default: return <h1 key={`h1-${i}`} id={id} style={style} onClick={() => onHeadingClick?.(id)}>{parseInline(content, onHeadingClick)}</h1>;
        }
      };
      
      elements.push(renderHeading());
      continue;
    }
    
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.slice(2);
      elements.push(<li key={`li-${i}`} style={{ color: 'var(--color-text-primary)', marginLeft: '20px', marginBottom: '6px', listStyleType: 'disc' }}>{parseInline(text, onHeadingClick)}</li>);
      continue;
    }
    
    if (trimmed.match(/^(\d+)\.\s/)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(<li key={`ol-${i}`} style={{ color: 'var(--color-text-primary)', marginLeft: '20px', marginBottom: '6px', listStyleType: 'decimal' }}>{parseInline(match[2], onHeadingClick)}</li>);
        continue;
      }
    }
    
    if (trimmed.startsWith('> ')) {
      elements.push(<blockquote key={`bq-${i}`} style={{ borderLeft: '3px solid var(--color-accent)', paddingLeft: '16px', margin: '12px 0', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{parseInline(trimmed.slice(2), onHeadingClick)}</blockquote>);
      continue;
    }
    
    if (trimmed.startsWith('---')) {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />);
      continue;
    }
    
    elements.push(<p key={`p-${i}`} style={{ color: 'var(--color-text-primary)', marginBottom: '10px', lineHeight: 1.7 }}>{parseInline(line, onHeadingClick)}</p>);
  }
  
  return elements;
}

function parseInline(text: string, onHeadingClick?: (id: string) => void): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  while (remaining) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++} style={{ fontWeight: 700, color: '#fff' }}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(<em key={key++} style={{ fontStyle: 'italic' }}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      parts.push(<code key={key++} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      
      if (linkUrl.startsWith('#')) {
        const anchorId = linkUrl.slice(1);
        parts.push(
          <a 
            key={key++} 
            href={linkUrl}
            onClick={(e) => {
              e.preventDefault();
              onHeadingClick?.(anchorId);
            }}
            style={{ color: 'var(--color-accent)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {linkText}
          </a>
        );
      } else {
        parts.push(<a key={key++} href={linkUrl} style={{ color: 'var(--color-accent)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">{linkText}</a>);
      }
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }
    
    const textMatch = remaining.match(/^[^`*\[\]>_-]+/);
    if (textMatch) {
      parts.push(textMatch[0]);
      remaining = remaining.slice(textMatch[0].length);
      continue;
    }
    
    parts.push(remaining[0]);
    remaining = remaining.slice(1);
  }
  
  return parts;
}

export function NoteTab({ videoId }: { videoId: string }) {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoId) loadNote();
  }, [videoId]);

  const loadNote = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getLocalFile(videoId, 'note');
      if (response.success && response.data) {
        setContent(response.data);
      }
    } catch (err) {
      console.error('加载笔记失败:', err);
      setError('加载笔记失败');
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    setIsSaving(true);
    try {
      await apiService.saveLocalFile(videoId, 'note', content);
      setIsEditing(false);
    } catch (err) {
      console.error('保存笔记失败:', err);
      setError('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleHeadingClick = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const scrollbarStyle = `
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{scrollbarStyle}</style>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg style={{ width: '20px', height: '20px', color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>AI 笔记</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditing ? (
            <>
              <button onClick={() => setIsEditing(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}>取消</button>
              <button onClick={saveNote} disabled={isSaving} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: '#22c55e', color: '#fff', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.5 : 1 }}>
                {isSaving ? '保存中...' : '保存'}
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              编辑
            </button>
          )}
        </div>
      </div>

      <div 
        ref={contentRef}
        onDoubleClick={handleDoubleClick}
        style={{ flex: 1, overflow: 'auto', padding: '16px', cursor: isEditing ? 'text' : 'pointer' }}
      >
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              padding: '16px',
              fontSize: '14px',
              fontFamily: 'monospace',
              borderRadius: '8px',
              border: 'none',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.6,
            }}
          />
        ) : content ? (
          <div style={{ maxWidth: '800px' }}>
            {parseMarkdown(content, handleHeadingClick)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>暂无笔记</p>
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>双击内容区域开始编辑</p>
          </div>
        )}
      </div>

      {!isEditing && content && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          <span>{content.length} 字符</span>
          <span>双击可编辑</span>
        </div>
      )}
    </div>
  );
}