import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../../../services/api';

interface MindMapTabProps {
  videoId?: string;
}

export function MindMapTab({ videoId: propVideoId }: MindMapTabProps) {
  const params = useParams<{ videoId: string }>();
  const videoId = propVideoId || params.videoId;
  const svgRef = useRef<SVGSVGElement>(null);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    loadAndRender();
  }, [videoId]);
  
  const loadAndRender = async () => {
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
      
      setMarkdown(lines || '# 无标题结构');
      
      if (svgRef.current && lines) {
        const { Markmap } = await import('markmap');
        Markmap.create(svgRef.current, {
          color: () => '#22c55e',
        } as any, lines);
      }
    } catch (err) {
      console.error('渲染思维导图失败:', err);
      setError('渲染失败');
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
    <div className="h-full overflow-auto p-4">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}