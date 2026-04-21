import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TranscriptTab } from './TranscriptTab';
import { NoteTab } from './NoteTab';
import { MindMapTab } from './MindMapTab';

export { TranscriptTab, NoteTab, MindMapTab };

type TabType = 'subtitle' | 'note' | 'mindmap';

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  {
    id: 'subtitle',
    label: '字幕',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'note',
    label: '笔记',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    id: 'mindmap',
    label: '导图',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
];

export default function AiNotePanel() {
  const { videoId } = useParams<{ videoId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('subtitle');
  const [selectedSubtitleFilename, setSelectedSubtitleFilename] = useState<string>('');

  if (!videoId) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-primary)',
        }}
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>无效的视频 ID</p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            to={`/video/${videoId}`}
            style={{
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>AI 笔记</h1>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{videoId}</p>
          </div>
        </div>
        <Link
          to={`/video/${videoId}`}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            color: 'var(--color-text-secondary)',
            borderRadius: '8px',
          }}
        >
          返回视频
        </Link>
      </header>

      {/* Tab导航 */}
      <nav
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border)',
          background: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 0',
              fontSize: '14px',
              fontWeight: 500,
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <span style={{ color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '48px',
                  height: '2px',
                  background: 'var(--color-accent)',
                  borderRadius: '2px',
                }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* 内容区域 */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'subtitle' && (
          <TranscriptTab
            videoId={videoId}
            onSubtitleFileChange={setSelectedSubtitleFilename}
          />
        )}
        {activeTab === 'note' && (
          <NoteTab
            videoId={videoId}
            selectedSubtitleFilename={selectedSubtitleFilename}
          />
        )}
        {activeTab === 'mindmap' && <MindMapTab videoId={videoId} />}
      </main>
    </div>
  );
}