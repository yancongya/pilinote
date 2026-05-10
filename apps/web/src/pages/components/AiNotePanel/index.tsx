import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../../../services/api';
import { TranscriptTab } from './TranscriptTab';
import { NoteTab } from './NoteTab';
import { MindMapTab } from './MindMapTab';
import { getPlayableEntries, type LocalPlaybackEntry } from '../../videoDetailPlayback';
import {
  buildAiNotePanelCacheKey,
  readAiNotePanelCache,
  writeAiNotePanelCache,
  type AiNotePanelCacheSnapshot,
} from '../../../services/aiNoteModalCache';

export { TranscriptTab, NoteTab, MindMapTab };

type TabType = 'subtitle' | 'note' | 'mindmap';

export function getAiNoteTabFromHash(hash: string): TabType {
  const normalized = hash.replace(/^#/, '')
  if (normalized === 'note' || normalized === 'mindmap' || normalized === 'subtitle') {
    return normalized
  }
  return 'subtitle'
}

export function getAiNoteTabHash(tab: TabType): string {
  return `#${tab}`
}

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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h6M9 19h6M5 9h4m6 6h4M12 5v14m0-14a2 2 0 110 4 2 2 0 010-4zm0 10a2 2 0 110 4 2 2 0 010-4z" />
      </svg>
    ),
  },
];

export default function AiNotePanel() {
  const { videoId, opusId } = useParams<{ videoId?: string; opusId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { folderPath?: string } | null;
  const [selectedSubtitleFilename, setSelectedSubtitleFilename] = useState<string>('');
  const [noteMarkdown, setNoteMarkdown] = useState('');
  const [noteTitle, setNoteTitle] = useState('mindmap');
  const [resolvedFileId, setResolvedFileId] = useState<string>('');
  const [localPlaybackEntries, setLocalPlaybackEntries] = useState<LocalPlaybackEntry[]>([]);
  const [mountedTabs, setMountedTabs] = useState<Set<TabType>>(() => new Set(['subtitle']));
  const activeTab = useMemo(() => getAiNoteTabFromHash(location.hash), [location.hash]);
  const mediaId = videoId || opusId || '';
  const backToDetailPath = opusId ? `/opus/${mediaId}` : `/video/${mediaId}`;
  const isImageTextMode = Boolean(opusId);
  const fallbackFolderPath = routeState?.folderPath || '';
  const activeFileId = resolvedFileId || mediaId;
  const panelCacheKey = useMemo(() => buildAiNotePanelCacheKey({
    videoId: mediaId,
    pipelineMode: isImageTextMode ? 'image_text' : 'video',
  }), [isImageTextMode, mediaId]);
  const hydratedCacheRef = useRef(false);
  const skipNextPanelCacheWriteRef = useRef(false);

  useEffect(() => {
    if (!location.hash || !['#subtitle', '#note', '#mindmap'].includes(location.hash)) {
      const cached = readAiNotePanelCache(panelCacheKey);
      const fallbackTab = cached?.activeTab || 'subtitle';
      navigate(`#${fallbackTab}`, { replace: true });
    }
  }, [location.hash, navigate, panelCacheKey]);

  useEffect(() => {
    hydratedCacheRef.current = false;
    if (!mediaId) return;

    const cached = readAiNotePanelCache(panelCacheKey);
    if (cached && cached.kind === 'panel' && cached.videoId === mediaId) {
      skipNextPanelCacheWriteRef.current = true;
      setSelectedSubtitleFilename(cached.selectedSubtitleFilename || '');
      setNoteMarkdown(cached.noteMarkdown || '');
      setNoteTitle(cached.noteTitle || 'mindmap');
      setResolvedFileId(cached.resolvedFileId || '');
    }
    hydratedCacheRef.current = true;
  }, [mediaId, panelCacheKey]);

  useEffect(() => {
    let cancelled = false;

    const resolveLocalFileId = async () => {
      if (fallbackFolderPath) {
        setResolvedFileId(fallbackFolderPath);
        return;
      }

      if (!mediaId || mediaId === 'undefined') {
        setResolvedFileId('');
        return;
      }

      if (!isImageTextMode) {
        setResolvedFileId(mediaId);
        return;
      }

      try {
        const response = await apiService.getLocalOpusContent(mediaId);
        if (cancelled) return;

        const folderPath = response.success && response.data?.folder_path ? String(response.data.folder_path) : mediaId;
        setResolvedFileId(folderPath);
      } catch (err) {
        if (!cancelled) {
          setResolvedFileId(mediaId);
        }
        console.error('解析图文本地目录失败:', err);
      }
    };

    void resolveLocalFileId();

    return () => {
      cancelled = true;
    };
  }, [mediaId, isImageTextMode, fallbackFolderPath]);

  useEffect(() => {
    let cancelled = false;

    const loadLocalPlaybackEntries = async () => {
      if (isImageTextMode || !mediaId || mediaId === 'undefined') {
        setLocalPlaybackEntries([]);
        return;
      }

      try {
        const response = await apiService.getLocalPlaybackMap(mediaId);
        if (cancelled) return;

        const entries = response.success ? getPlayableEntries(response.data) : [];
        setLocalPlaybackEntries(entries);
        if (!entries.length) {
          setResolvedFileId(mediaId);
          return;
        }

        setResolvedFileId((current) => {
          if (current && entries.some((entry) => entry.path === current)) {
            return current;
          }
          return entries[0].path;
        });
      } catch (err) {
        if (!cancelled) {
          setLocalPlaybackEntries([]);
          setResolvedFileId(mediaId);
        }
        console.error('加载 AI 页面本地分P失败:', err);
      }
    };

    void loadLocalPlaybackEntries();

    return () => {
      cancelled = true;
    };
  }, [isImageTextMode, mediaId]);

  useEffect(() => {
    setMountedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;

    const loadNoteSnapshot = async () => {
      const targetId = activeFileId;
      if (!targetId || targetId === 'undefined') return;
      try {
        const response = await apiService.getLocalFile(targetId, 'note');
        if (!cancelled && response.success) {
          setNoteMarkdown(typeof response.data === 'string' ? response.data : '');
          const fileName = response.file_path?.split('/').pop() || 'mindmap';
          setNoteTitle(
            fileName.replace(/\.ai-note\.md$/i, '').replace(/\.md$/i, '') || 'mindmap',
          );
          if (hydratedCacheRef.current) {
            const snapshot: AiNotePanelCacheSnapshot = {
              version: 1,
              kind: 'panel',
              videoId: mediaId,
              pipelineMode: isImageTextMode ? 'image_text' : 'video',
              updatedAt: Date.now(),
              activeTab,
              noteMarkdown: typeof response.data === 'string' ? response.data : '',
              noteTitle: fileName.replace(/\.ai-note\.md$/i, '').replace(/\.md$/i, '') || 'mindmap',
              resolvedFileId: targetId,
              selectedSubtitleFilename,
            }
            writeAiNotePanelCache(panelCacheKey, snapshot)
          }
        }
      } catch (err) {
        if (!cancelled) {
          const cached = readAiNotePanelCache(panelCacheKey);
          if (!(cached && cached.kind === 'panel' && cached.videoId === mediaId)) {
            setNoteMarkdown('');
            setNoteTitle('mindmap');
          }
        }
        console.error('加载笔记快照失败:', err);
      }
    };

    void loadNoteSnapshot();

    return () => {
      cancelled = true;
    };
  }, [activeFileId, activeTab, isImageTextMode, mediaId, panelCacheKey, selectedSubtitleFilename]);

  useEffect(() => {
    if (!hydratedCacheRef.current) return;
    if (skipNextPanelCacheWriteRef.current) {
      skipNextPanelCacheWriteRef.current = false;
      return;
    }
    if (!mediaId) return;

    const snapshot: AiNotePanelCacheSnapshot = {
      version: 1,
      kind: 'panel',
      videoId: mediaId,
      pipelineMode: isImageTextMode ? 'image_text' : 'video',
      updatedAt: Date.now(),
      activeTab,
      noteMarkdown,
      noteTitle,
      resolvedFileId,
      selectedSubtitleFilename,
    }
    writeAiNotePanelCache(panelCacheKey, snapshot)
  }, [
    activeTab,
    isImageTextMode,
    mediaId,
    noteMarkdown,
    noteTitle,
    panelCacheKey,
    resolvedFileId,
    selectedSubtitleFilename,
  ])

  if (!mediaId) {
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
            to={backToDetailPath}
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
          to={backToDetailPath}
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

      {!isImageTextMode && localPlaybackEntries.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'rgba(255,255,255,0.03)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', flex: '0 0 auto' }}>
            分P
          </span>
          <select
            value={activeFileId}
            onChange={(event) => {
              setResolvedFileId(event.target.value);
              setSelectedSubtitleFilename('');
              setNoteMarkdown('');
              setNoteTitle('mindmap');
            }}
            style={{
              minWidth: 0,
              flex: 1,
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
            }}
          >
            {localPlaybackEntries.map((entry, index) => (
              <option key={entry.path} value={entry.path}>
                {entry.title || `P${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

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
            onClick={() => {
              window.requestAnimationFrame(() => {
                navigate(getAiNoteTabHash(tab.id), { replace: true });
              });
            }}
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
            <span>{tab.id === 'subtitle' && isImageTextMode ? '原文' : tab.label}</span>
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
        {mountedTabs.has('subtitle') && (
          <div style={{ display: activeTab === 'subtitle' ? 'block' : 'none', height: '100%' }}>
            {isImageTextMode ? (
            <NoteTab
              videoId={activeFileId}
              fileType="source"
              analysisPipelineMode="image_text"
              readOnly
              onContentSnapshotChange={setNoteMarkdown}
            />
          ) : (
            <TranscriptTab
                videoId={activeFileId}
                onSubtitleFileChange={setSelectedSubtitleFilename}
              />
            )}
          </div>
        )}
        {mountedTabs.has('note') && (
          <div style={{ display: activeTab === 'note' ? 'block' : 'none', height: '100%' }}>
            <NoteTab
              videoId={activeFileId}
              selectedSubtitleFilename={selectedSubtitleFilename}
              onContentSnapshotChange={setNoteMarkdown}
              fileType="note"
              analysisPipelineMode={isImageTextMode ? 'image_text' : 'video'}
            />
          </div>
        )}
        {mountedTabs.has('mindmap') && (
          <div style={{ display: activeTab === 'mindmap' ? 'block' : 'none', height: '100%' }}>
            <MindMapTab content={noteMarkdown} title={noteTitle} />
          </div>
        )}
      </main>
    </div>
  );
}
