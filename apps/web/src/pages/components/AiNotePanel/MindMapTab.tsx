import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../../../services/api';

interface MindMapTabProps {
  videoId?: string;
}

interface TreeNode {
  name: string;
  children: TreeNode[];
}

function parseToTree(lines: string): TreeNode {
  const root: TreeNode = { name: 'root', children: [] };
  const stack: TreeNode[] = [root];
  
  for (const line of lines.split('\n')) {
    const match = line.match(/^(#+)\s*(.*)$/);
    if (!match) continue;
    
    const level = match[1].length;
    const name = match[2].trim();
    
    const node: TreeNode = { name, children: [] };
    
    while (stack.length > level) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  
  return root;
}

function TreeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <span className="text-green-400">• </span>
      <span className="text-gray-300">{node.name}</span>
      {node.children.map((child, i) => (
        <TreeView key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function MindMapTab({ videoId: propVideoId }: MindMapTabProps) {
  const params = useParams<{ videoId: string }>();
  const videoId = propVideoId || params.videoId;
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    loadData();
  }, [videoId]);
  
  const loadData = async () => {
    if (!videoId) {
      setError('无效的视频 ID');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await apiService.getLocalFile(videoId, 'note');
      if (!response.success || !response.data) {
        setError('暂无笔记文件');
        setLoading(false);
        return;
      }
      
      const lines = response.data
        .split('\n')
        .filter((line: string) => line.startsWith('#'))
        .map((line: string) => line.replace(/^#+\s*/, ''))
        .join('\n');
      
      if (!lines) {
        setError('无标题结构');
        setLoading(false);
        return;
      }
      
      setTree(parseToTree(lines));
    } catch (err) {
      console.error('加载失败:', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="p-4 text-gray-400">加载中...</div>;
  }
  
  if (error) {
    return <div className="p-4 text-gray-400">{error}</div>;
  }
  
  return (
    <div className="h-full overflow-auto p-4 font-mono text-sm">
      {tree && tree.children.map((child, i) => (
        <TreeView key={i} node={child} />
      ))}
    </div>
  );
}