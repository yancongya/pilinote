import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiService } from '../../../services/api';
import { useSettingsStore } from '../../../stores/settings';
import { useAiRuntimeState } from '../../../hooks/useAiRuntimeState';
import { aiRuntimeStateService } from '../../../services/aiRuntimeState';
import { getApiBaseUrl } from '../../../config/api';
import { useToast } from '../../../components/Toast';
import TermReplacementModal from '../../../components/ai/TermReplacementModal';

interface Subtitle {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

interface VersionMeta {
  hash: string;
  timestamp: number;
  filename: string;
  source: string;
  label: string;
}

interface SubtitleFile {
  name: string;
  path: string;
  source_label: string;
}

interface AnalysisIssue {
  index: number;
  type: 'typo' | 'grammar' | 'term';
  text: string;
  suggestion: string;
}

interface AnalysisStage {
  key: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: Record<string, any>;
}

const ANALYSIS_STAGE_DEFS = [
  { key: 'READ_NFO', label: '读取视频信息' },
  { key: 'SUBTITLE_OVERVIEW', label: '字幕概况' },
  { key: 'AI_ANALYZE', label: 'AI 修正分析' },
  { key: 'DONE', label: '完成' },
];

function parseSRT(content: string): Subtitle[] {
  const pattern = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n\n|\n*$)/g;
  const subtitles: Subtitle[] = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    subtitles.push({
      index: parseInt(match[1]),
      startTime: match[2],
      endTime: match[3],
      text: match[4].trim(),
    });
  }
  return subtitles;
}

function formatTimestamp(timeStr: string): string {
  return timeStr.replace(',', '.');
}

function formatVersionTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'ai': return 'AI';
    case 'auto': return '自动';
    case 'migration': return '迁移';
    case 'manual': return '手动';
    default: return source;
  }
}

export function TranscriptTab({ videoId, onSubtitleFileChange }: { videoId: string; onSubtitleFileChange?: (filename: string) => void }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showTermModal, setShowTermModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStages, setAnalysisStages] = useState<AnalysisStage[]>(ANALYSIS_STAGE_DEFS.map(d => ({ ...d, status: 'pending' as const })));
  const [analysisIssues, setAnalysisIssues] = useState<AnalysisIssue[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [analysisTaskId, setAnalysisTaskId] = useState('');
  const [showAnalysisResult, setShowAnalysisResult] = useState(false);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 版本管理状态
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [currentHash, setCurrentHash] = useState('');
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [subtitleFiles, setSubtitleFiles] = useState<SubtitleFile[]>([]);
  const [showSubtitleFileSelect, setShowSubtitleFileSelect] = useState(false);
  const [selectedSubtitleFilename, setSelectedSubtitleFilename] = useState<string>('');

  const settings = useSettingsStore((state) => state.settings);
  const aiRuntimeState = useAiRuntimeState();
  const testedModels = aiRuntimeState.testedModels || {};
  const { showToast } = useToast();

  const availableProviders = useMemo(() => {
    const providers = settings?.llm?.providers || [];
    return providers.filter((p) => testedModels[p.id]?.length > 0);
  }, [settings, testedModels]);

  const resetAnalysisState = useCallback(() => {
    setAnalysisStages(ANALYSIS_STAGE_DEFS.map(d => ({ ...d, status: 'pending' as const })));
    setAnalysisIssues([]);
    setAnalysisSummary('');
    setAnalysisError('');
    setAnalysisTaskId('');
    setShowAnalysisResult(false);
  }, []);

  const stopAnalysis = useCallback(async () => {
    analysisAbortRef.current?.abort();
    if (analysisTaskId) {
      try {
        await fetch(`${getApiBaseUrl()}/api/ai/subtitle/cancel/${encodeURIComponent(analysisTaskId)}`, { method: 'POST' });
        showToast('已取消字幕纠正', 'success');
      } catch {
        showToast('取消字幕纠正失败', 'error');
      }
    } else {
      showToast('已停止字幕纠正请求', 'info');
    }
    setIsAnalyzing(false);
  }, [analysisTaskId, showToast]);

  const handleApplyFix = useCallback(async (fixIssues: AnalysisIssue[]) => {
    if (!fixIssues?.length) return;

    const blocks = content.split(/\n\n+/);
    const issueMap = new Map<number, AnalysisIssue>();
    for (const issue of fixIssues) {
      if (issue.index && issue.suggestion) {
        issueMap.set(issue.index, issue);
      }
    }

    const fixedBlocks = blocks.map(block => {
      const lines = block.split('\n');
      if (lines.length < 3) return block;
      const idx = parseInt(lines[0]);
      const fix = issueMap.get(idx);
      if (fix) {
        lines[2] = fix.suggestion;
      }
      return lines.join('\n');
    });

    const fixedContent = fixedBlocks.join('\n\n') + '\n';

    try {
      await apiService.saveLocalFile(videoId, 'subtitle', fixedContent, selectedSubtitleFilename || undefined);
      setContent(fixedContent);
      await loadVersions(selectedSubtitleFilename || undefined);
      setShowAnalysisResult(false);
      showToast('字幕已应用修正', 'success');
    } catch (err) {
      console.error('应用修正失败:', err);
      showToast('应用修正失败', 'error');
    }
  }, [content, selectedSubtitleFilename, showToast, videoId]);

  const startAnalysis = useCallback(async () => {
    if (isAnalyzing) return;
    if (!selectedProvider && availableProviders.length === 0) {
      showToast('请先配置并验证 AI 模型', 'warning');
      return;
    }
    resetAnalysisState();
    setIsAnalyzing(true);
    showToast('已开始字幕纠正', 'info');

    const ac = new AbortController();
    analysisAbortRef.current = ac;

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/ai/subtitle/pipeline-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          content,
          model_provider: selectedProvider || availableProviders[0]?.id || 'openai',
          model_name: selectedModels[selectedProvider || availableProviders[0]?.id || ''] || undefined,
        }),
        signal: ac.signal,
      });

      if (!response.body) throw new Error('无法建立连接');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            const { stage, status, data } = event;

            if (stage === 'META' && data?.task_id) {
              setAnalysisTaskId(data.task_id);
            }

            setAnalysisStages(prev => prev.map(s => (s.key === stage ? { ...s, status, data } : s)));

            if (stage === 'DONE' && status === 'completed') {
              setAnalysisIssues(data?.issues || []);
              setAnalysisSummary(data?.summary || '');
              setIsAnalyzing(false);
              analysisAbortRef.current = null;
              setShowAnalysisResult(true);
              showToast('字幕纠正完成', 'success');
            }

            if (stage === 'DONE' && status === 'error') {
              const message = data?.error || '分析失败';
              setAnalysisError(message);
              setIsAnalyzing(false);
              analysisAbortRef.current = null;
              showToast(message, 'error');
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsAnalyzing(false);
        analysisAbortRef.current = null;
        showToast('已取消字幕纠正', 'info');
        return;
      }
      const message = err?.message || '连接失败';
      setAnalysisError(message);
      setIsAnalyzing(false);
      analysisAbortRef.current = null;
      showToast(message, 'error');
    }
  }, [availableProviders.length, content, isAnalyzing, selectedModels, selectedProvider, showToast, videoId, resetAnalysisState]);

  useEffect(() => {
    if (videoId) {
      loadSubtitle();
      loadVersions();
      loadSubtitleFiles();
    }
    aiRuntimeStateService.refresh();
  }, [videoId]);

  // 当字幕文件列表加载完成后，用默认文件名重新加载
  useEffect(() => {
    if (selectedSubtitleFilename && videoId) {
      loadSubtitle(selectedSubtitleFilename);
      loadVersions(selectedSubtitleFilename);
    }
  }, [selectedSubtitleFilename]);

  useEffect(() => {
    if (content) setSubtitles(parseSRT(content));
  }, [content]);

  // ---- 数据加载 ----

  const loadSubtitle = async (filename?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getLocalFile(videoId, 'subtitle', filename);
      if (response.success && response.data) {
        setContent(response.data);
      }
    } catch (err) {
      console.error('加载字幕失败:', err);
      setError('加载字幕失败');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (filename?: string) => {
    try {
      const response = await apiService.getVersions(videoId, 'subtitle', filename);
      if (response.success && response.data) {
        setVersions(response.data.versions || []);
        setCurrentHash(response.data.current || '');
      }
    } catch (err) {
      console.error('加载版本列表失败:', err);
    }
  };

  const loadSubtitleFiles = async () => {
    try {
      const response = await apiService.getSubtitleFiles(videoId);
      if (response.success && response.data) {
        setSubtitleFiles(response.data);
        // 默认选中第一个字幕文件
        if (response.data.length > 0 && !selectedSubtitleFilename) {
          setSelectedSubtitleFilename(response.data[0].name);
          onSubtitleFileChange?.(response.data[0].name);
        }
      }
    } catch (err) {
      console.error('加载字幕文件列表失败:', err);
    }
  };

  // ---- 字幕编辑 ----

  const handleDoubleClick = (subtitle: Subtitle, index: number) => {
    setEditingIndex(index);
    setEditContent(subtitle.text);
  };

  const handleSaveLine = async () => {
    if (editingIndex === null) return;

    const newSubtitles = [...subtitles];
    newSubtitles[editingIndex].text = editContent;

    const newContent = newSubtitles.map((s, i) =>
      `${i + 1}\n${s.startTime} --> ${s.endTime}\n${s.text}`
    ).join('\n\n');

    try {
      await apiService.saveLocalFile(videoId, 'subtitle', newContent + '\n', selectedSubtitleFilename || undefined);
      setContent(newContent);
      setEditingIndex(null);
      // 刷新版本列表（save_local_file 会自动创建版本快照）
      loadVersions(selectedSubtitleFilename || undefined);
    } catch (err) {
      console.error('保存字幕失败:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditContent('');
  };

  const handleApplyTerms = () => {
    setShowTermModal(true);
  };

  const handleTermApplied = (newContent: string) => {
    setContent(newContent);
    loadVersions(selectedSubtitleFilename || undefined);
  };

  useEffect(() => {
    if (availableProviders.length > 0 && Object.keys(selectedModels).length === 0) {
      const defaults: Record<string, string> = {};
      availableProviders.forEach(p => {
        const models = testedModels[p.id] || p.models || [];
        if (models.length > 0) {
          defaults[p.id] = models[0];
        }
      });
      setSelectedModels(defaults);
      if (!selectedProvider) {
        setSelectedProvider(availableProviders[0].id);
      }
    }
  }, [availableProviders, testedModels]);

  // ---- 版本操作 ----

  const handleSwitchVersion = async (hash: string) => {
    try {
      const response = await apiService.switchVersion(videoId, 'subtitle', hash, selectedSubtitleFilename || undefined);
      if (response.success) {
        // 切换成功后重新加载字幕内容
        await loadSubtitle(selectedSubtitleFilename || undefined);
        await loadVersions(selectedSubtitleFilename || undefined);
      }
    } catch (err) {
      console.error('切换版本失败:', err);
    }
  };

  const handleDeleteVersion = async (hash: string) => {
    try {
      const response = await apiService.deleteVersion(videoId, 'subtitle', hash, selectedSubtitleFilename || undefined);
      if (response.success) {
        await loadVersions(selectedSubtitleFilename || undefined);
      }
    } catch (err) {
      console.error('删除版本失败:', err);
    }
  };

  const handleSaveManualVersion = async () => {
    try {
      await apiService.saveVersion(videoId, 'subtitle', content, 'manual', '手动保存', selectedSubtitleFilename || undefined);
      await loadVersions(selectedSubtitleFilename || undefined);
    } catch (err) {
      console.error('手动保存版本失败:', err);
    }
  };

  const filteredSubtitles = searchQuery
    ? subtitles.filter(s => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : subtitles;

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
          <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>加载字幕中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '24px' }}>
        <style>{scrollbarStyle}</style>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{error}</p>
        <button onClick={() => loadSubtitle(selectedSubtitleFilename || undefined)} style={{ padding: '8px 16px', background: 'var(--color-accent)', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>重试</button>
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '24px' }}>
        <style>{scrollbarStyle}</style>
        <div style={{ width: '80px', height: '80px', borderRadius: '16px', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg style={{ width: '40px', height: '40px', color: 'var(--color-text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>暂无字幕文件</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <style>{scrollbarStyle}</style>

      {/* 主内容区 */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minWidth: 0 }}>

        {/* 搜索栏 */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--color-text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索字幕..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                padding: '8px 12px 8px 36px',
                fontSize: '14px',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* 字幕文件选择下拉 */}
          {subtitleFiles.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (subtitleFiles.length > 1) {
                    setShowSubtitleFileSelect(!showSubtitleFileSelect);
                  }
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  background: showSubtitleFileSelect ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                  color: showSubtitleFileSelect ? '#fff' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: subtitleFiles.length > 1 ? 'pointer' : 'default',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {subtitleFiles.find(f => f.name === selectedSubtitleFilename)?.source_label || '字幕来源'}
                {subtitleFiles.length > 1 && (
                  <svg style={{ width: '12px', height: '12px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              {showSubtitleFileSelect && subtitleFiles.length > 1 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '4px',
                  zIndex: 100,
                  minWidth: '160px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  {subtitleFiles.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => {
                        setSelectedSubtitleFilename(f.name);
                        onSubtitleFileChange?.(f.name);
                        setShowSubtitleFileSelect(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        background: selectedSubtitleFilename === f.name ? 'var(--color-accent)' : 'transparent',
                        color: selectedSubtitleFilename === f.name ? '#fff' : 'var(--color-text-primary)',
                        border: 'none',
                        fontSize: '12px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSubtitleFilename !== f.name) {
                          e.currentTarget.style.background = 'var(--color-bg-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSubtitleFilename !== f.name) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{f.source_label}</div>
                      <div style={{ fontSize: '10px', color: selectedSubtitleFilename === f.name ? 'rgba(255,255,255,0.7)' : 'var(--color-text-tertiary)', marginTop: '2px' }}>{f.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 模型选择下拉按钮 */}
          {availableProviders.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowModelSelect(!showModelSelect)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  background: showModelSelect ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                  color: showModelSelect ? '#fff' : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {selectedModels[selectedProvider || availableProviders[0]?.id] || '选择模型'}
                <svg style={{ width: '12px', height: '12px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 模型下拉列表 */}
              {showModelSelect && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '4px',
                  zIndex: 100,
                  minWidth: '180px',
                  maxHeight: '200px',
                  overflow: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  {availableProviders.map((provider) => {
                    const models = testedModels[provider.id] || [];
                    return (
                      <div key={provider.id}>
                        <div style={{ padding: '6px 10px', fontSize: '10px', color: 'var(--color-text-tertiary)', borderBottom: '1px solid var(--color-border)' }}>
                          {provider.name || provider.id}
                        </div>
                        {models.map((model: string) => (
                          <button
                            key={model}
                            onClick={() => {
                              setSelectedProvider(provider.id);
                              setSelectedModels(prev => ({ ...prev, [provider.id]: model }));
                              setShowModelSelect(false);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '8px 12px',
                              textAlign: 'left',
                              background: selectedModels[provider.id] === model ? 'var(--color-accent)' : 'transparent',
                              border: 'none',
                              color: selectedModels[provider.id] === model ? '#fff' : 'var(--color-text-primary)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) => {
                              if (selectedModels[provider.id] !== model) {
                                e.currentTarget.style.background = 'var(--color-bg-secondary)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedModels[provider.id] !== model) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 纠正按钮 */}
          <button
            onClick={isAnalyzing ? stopAnalysis : startAnalysis}
            disabled={!content && !isAnalyzing}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              background: isAnalyzing ? '#ef4444' : 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              cursor: !content && !isAnalyzing ? 'not-allowed' : 'pointer',
              opacity: !content && !isAnalyzing ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isAnalyzing ? '停止' : '纠正'}
          </button>

          {/* 术语替换按钮 */}
          <button
            onClick={handleApplyTerms}
            disabled={!content}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              background: '#8b5cf6',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            术语替换
          </button>
        </div>

        {analysisError && (
          <div style={{ margin: '12px 16px 0', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '13px' }}>
            {analysisError}
          </div>
        )}

        {/* 字幕列表 */}
        <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {filteredSubtitles.map((subtitle, idx) => (
            <div
              key={subtitle.index}
              onDoubleClick={() => handleDoubleClick(subtitle, idx)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '4px',
                cursor: 'pointer',
                transition: 'background 0.15s',
                background: editingIndex === idx ? 'var(--color-accent)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (editingIndex !== idx) e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                if (editingIndex !== idx) e.currentTarget.style.background = 'transparent';
              }}
            >
              {editingIndex === idx ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                    <span style={{ fontFamily: 'monospace' }}>{formatTimestamp(subtitle.startTime)}</span>
                    <span>→</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatTimestamp(subtitle.endTime)}</span>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      background: 'var(--color-bg-primary)',
                      color: 'var(--color-text-primary)',
                      padding: '8px',
                      fontSize: '14px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-accent)',
                      resize: 'none',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleSaveLine}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      保存
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'monospace' }}>{formatTimestamp(subtitle.startTime)}</span>
                    <span>→</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatTimestamp(subtitle.endTime)}</span>
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: 1.5, color: searchQuery && subtitle.text.toLowerCase().includes(searchQuery.toLowerCase()) ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                    {subtitle.text}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 底部统计 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderTop: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          <span>{subtitles.length} 条字幕</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>双击字幕行编辑</span>
            <button
              onClick={() => setShowVersionPanel(!showVersionPanel)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                background: showVersionPanel ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                color: showVersionPanel ? '#fff' : 'var(--color-text-secondary)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {versions.length > 0 ? `${versions.length} 个版本` : '版本'}
            </button>
          </div>
        </div>
      </div>

      {/* 版本历史侧边栏 */}
      {showVersionPanel && (
        <div style={{
          width: '260px',
          flexShrink: 0,
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>版本历史</span>
            <button
              onClick={handleSaveManualVersion}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              保存版本
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            {[...versions].reverse().map((v) => {
              const isCurrent = v.hash === currentHash;
              return (
                <div
                  key={v.hash}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    background: isCurrent ? 'rgba(59,130,246,0.1)' : 'transparent',
                    border: isCurrent ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: isCurrent ? '#3b82f6' : 'var(--color-text-primary)' }}>
                      {formatVersionTime(v.timestamp)}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: v.source === 'ai' ? 'rgba(16,185,129,0.15)' :
                                  v.source === 'manual' ? 'rgba(59,130,246,0.15)' :
                                  v.source === 'auto' ? 'rgba(139,92,246,0.15)' :
                                  'rgba(107,114,128,0.15)',
                      color: v.source === 'ai' ? '#10b981' :
                             v.source === 'manual' ? '#3b82f6' :
                             v.source === 'auto' ? '#8b5cf6' :
                             '#6b7280',
                    }}>
                      {sourceLabel(v.source)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--color-text-tertiary)' }}>{v.hash}</span>
                    {isCurrent && (
                      <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 500 }}>当前</span>
                    )}
                  </div>
                  {v.label && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>{v.label}</div>
                  )}
                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {!isCurrent && (
                      <button
                        onClick={() => handleSwitchVersion(v.hash)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          background: 'var(--color-bg-secondary)',
                          color: 'var(--color-text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        切换
                      </button>
                    )}
                    {!isCurrent && (
                      <button
                        onClick={() => { if (confirm('确定删除此版本？')) handleDeleteVersion(v.hash); }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          background: 'transparent',
                          color: '#ef4444',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0.7,
                        }}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {versions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--color-text-tertiary)', fontSize: '12px' }}>
                暂无版本记录
              </div>
            )}
          </div>
        </div>
      )}

      {showAnalysisResult && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 80,
          padding: '16px',
        }}>
          <div style={{ width: 'min(820px, 100%)', maxHeight: '88vh', overflow: 'auto', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>字幕纠正结果</div>
                {analysisSummary && <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{analysisSummary}</div>}
              </div>
              <button type="button" onClick={() => setShowAnalysisResult(false)} style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>关闭</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {analysisStages.map(stage => (
                <div key={stage.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '9999px', background: 'var(--color-bg-secondary)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-primary)' }}>{stage.label}</span>
                  <span style={{ fontSize: '11px', color: stage.status === 'completed' ? '#22c55e' : stage.status === 'error' ? '#ef4444' : 'var(--color-accent)' }}>
                    {stage.status === 'completed' ? '完成' : stage.status === 'processing' ? '处理中' : stage.status === 'error' ? '失败' : '等待'}
                  </span>
                </div>
              ))}
            </div>
            {analysisIssues.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>发现 {analysisIssues.length} 个问题</div>
                {analysisIssues.map((issue, index) => (
                  <div key={`${issue.index}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg-secondary)' }}>
                    <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', color: '#fff', background: issue.type === 'typo' ? '#ef4444' : issue.type === 'grammar' ? '#f59e0b' : '#8b5cf6' }}>{issue.type === 'typo' ? '错字' : issue.type === 'grammar' ? '语法' : '术语'}</span>
                    <span style={{ color: '#ef4444', textDecoration: 'line-through', flex: 1, minWidth: 0 }}>{issue.text}</span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
                    <span style={{ color: '#22c55e', flex: 1, minWidth: 0 }}>{issue.suggestion}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                  <button type="button" onClick={() => { setShowAnalysisResult(false); showToast('已关闭纠正结果', 'info'); }} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>稍后处理</button>
                  {analysisIssues.length > 0 && (
                    <button type="button" onClick={() => handleApplyFix(analysisIssues)} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer' }}>应用修正</button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#22c55e' }}>字幕质量良好，未发现问题</div>
            )}
          </div>
        </div>
      )}

      {/* 术语替换弹窗 */}
      <TermReplacementModal
        isOpen={showTermModal}
        onClose={() => setShowTermModal(false)}
        onApply={handleTermApplied}
        content={content}
        videoId={videoId}
      />
    </div>
  );
}
