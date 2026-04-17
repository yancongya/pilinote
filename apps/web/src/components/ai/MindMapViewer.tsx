import { useEffect, useState } from 'react';

interface MindMapViewerProps {
  markdown: string;
  className?: string;
}

export function MindMapViewer({ markdown, className = '' }: MindMapViewerProps) {
  const [outline, setOutline] = useState<string>('');
  
  useEffect(() => {
    // 简单解析 Markdown 标题为大纲
    const lines = markdown.split('\n')
      .filter(line => line.startsWith('#'))
      .map(line => line.replace(/^#+\s*/, ''))
      .join('\n');
    setOutline(lines);
  }, [markdown]);

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-2">思维导图</h3>
      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
        {outline || '无结构数据'}
      </pre>
      <p className="text-xs text-gray-500 mt-2">
        提示：完整思维导图需要安装 markmap 依赖
      </p>
    </div>
  );
}