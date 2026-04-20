import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../../../services/api';
import { MarkdownViewer } from '../../../components/ai/MarkdownViewer';

interface NoteTabProps {
  videoId?: string;
}

export function NoteTab({ videoId: propVideoId }: NoteTabProps) {
  const params = useParams<{ videoId: string }>();
  const videoId = propVideoId || params.videoId;
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadNote();
  }, [videoId]);
  
  const loadNote = async () => {
    setLoading(true);
    try {
      const response = await apiService.getLocalFile(videoId, 'note');
      if (response.success && response.data) {
        setContent(response.data);
      }
    } catch (error) {
      console.error('加载笔记失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const saveNote = async () => {
    try {
      await apiService.saveLocalFile(videoId, 'note', content);
      setIsEditing(false);
    } catch (error) {
      console.error('保存笔记失败:', error);
    }
  };
  
  if (loading) {
    return <div className="p-4 text-gray-400">加载中...</div>;
  }
  
  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex-1 overflow-auto">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-gray-800 text-gray-200 p-4 font-mono text-sm resize-none rounded"
            spellCheck={false}
          />
        ) : (
          <MarkdownViewer content={content || '暂无笔记'} />
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => isEditing ? saveNote() : setIsEditing(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
        >
          {isEditing ? '保存' : '编辑'}
        </button>
        {isEditing && (
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}