import { useState, useEffect } from 'react';
import { apiService } from '../../../services/api';

interface TreeNode {
  name: string;
  children: TreeNode[];
}

function parseToTree(markdown: string): TreeNode {
  const root: TreeNode = { name: 'root', children: [] };
  const stack: TreeNode[] = [root];
  
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const match = trimmed.match(/^(#+)\s*(.*)$/);
    if (match) {
      const level = match[1].length;
      const name = match[2].replace(/[*`\[\]]/g, '').trim();
      
      if (level > 6 || level < 1) continue;
      
      if (!name) continue;
      
      const node: TreeNode = { name, children: [] };
      
      while (stack.length > level) {
        stack.pop();
      }
      
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    }
  }
  
  return root;
}

function TreeNodeComponent({ node, depth = 0, defaultExpanded = true }: { node: TreeNode; depth?: number; defaultExpanded?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || depth < 2);
  const hasChildren = node.children.length > 0;
  
  const indentWidth = 20;
  const colorMap = ['#60a5fa', '#c084fc', '#4ade80', '#facc15', '#f472b6', '#22d3ee'];
  const lineColor = colorMap[depth % colorMap.length];
  
  return (
    <div style={{ userSelect: 'none' }}>
      <div
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 8px',
          borderRadius: '6px',
          cursor: hasChildren ? 'pointer' : 'default',
          transition: 'background 0.15s',
          paddingLeft: `${depth * indentWidth + 8}px`,
        }}
        onMouseEnter={(e) => {
          if (hasChildren) e.currentTarget.style.background = 'var(--color-bg-secondary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {hasChildren ? (
          <svg
            style={{
              width: '14px',
              height: '14px',
              color: 'var(--color-text-tertiary)',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              flexShrink: 0,
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <span style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: lineColor, fontSize: '16px' }}>•</span>
        )}
        <span style={{ color: lineColor, fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child, i) => (
            <TreeNodeComponent key={i} node={child} depth={depth + 1} defaultExpanded={depth < 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MindMapTab({ videoId }: { videoId: string }) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAll, setExpandedAll] = useState(false);

  useEffect(() => {
    if (videoId) loadData();
  }, [videoId]);

  const loadData = async () => {
    if (!videoId) {
      setError('无效的视频 ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getLocalFile(videoId, 'note');
      if (!response.success || !response.data) {
        setError('暂无笔记文件');
        setLoading(false);
        return;
      }

      const parsed = parseToTree(response.data);
      
      if (parsed.children.length === 0) {
        setError('笔记中没有标题结构 (# 或 ## 开头)');
        setLoading(false);
        return;
      }

      setTree(parsed);
    } catch (err) {
      console.error('加载失败:', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = () => {
    setExpandedAll(!expandedAll);
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
          <div style={{ width: '32px', height: '32px', border: '2px solid #a855f7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>分析笔记结构中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '24px' }}>
        <style>{scrollbarStyle}</style>
        <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ width: '40px', height: '40px', color: 'var(--color-text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{error}</p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px', marginTop: '4px' }}>使用 # 标题格式生成</p>
        </div>
        <button onClick={loadData} style={{ padding: '8px 16px', background: '#a855f7', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>重试</button>
      </div>
    );
  }

  if (!tree || tree.children.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '24px' }}>
        <style>{scrollbarStyle}</style>
        <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ width: '40px', height: '40px', color: 'var(--color-text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>无法解析思维导图</p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px', marginTop: '4px' }}>请使用 # 标题格式</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{scrollbarStyle}</style>
      
      {/* 操作栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg style={{ width: '20px', height: '20px', color: '#a855f7' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>思维导图</span>
        </div>
        <button
          onClick={toggleAll}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {expandedAll ? '收起全部' : '展开全部'}
        </button>
      </div>

      {/* 树形结构 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px', border: '1px solid var(--color-border)' }}>
          {tree.children.map((child, i) => (
            <TreeNodeComponent key={i} node={child} defaultExpanded={!expandedAll} />
          ))}
        </div>
      </div>

      {/* 底部信息 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
        <span>基于 Markdown # 标题生成</span>
        <span>点击展开/收起</span>
      </div>
    </div>
  );
}