import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { TranscriptTab } from './TranscriptTab';
import { NoteTab } from './NoteTab';
import { MindMapTab } from './MindMapTab';

export { TranscriptTab, NoteTab, MindMapTab };

type TabType = 'subtitle' | 'note' | 'mindmap';

export default function AiNotePanel() {
  const { videoId } = useParams<{ videoId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('subtitle');
  
  const tabs: { id: TabType; label: string }[] = [
    { id: 'subtitle', label: '字幕' },
    { id: 'note', label: '笔记' },
    { id: 'mindmap', label: '思维导图' },
  ];
  
  if (!videoId) return null;
  
  return (
    <div className="ai-note-panel h-full flex flex-col bg-gray-900">
      <div className="flex border-b border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-auto">
        {activeTab === 'subtitle' && <TranscriptTab videoId={videoId} />}
        {activeTab === 'note' && <NoteTab videoId={videoId} />}
        {activeTab === 'mindmap' && <MindMapTab videoId={videoId} />}
      </div>
    </div>
  );
}