import { useState, useEffect, useRef, useMemo } from 'react';
import { apiService } from '../../../services/api';
import { useSettingsStore } from '../../../stores/settings';
import { useAiRuntimeState } from '../../../hooks/useAiRuntimeState';
import { aiRuntimeStateService } from '../../../services/aiRuntimeState';

interface Subtitle {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

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

export function TranscriptTab({ videoId }: { videoId: string }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isApplyingTerms, setIsApplyingTerms] = useState(false);
  const [replacements, setReplacements] = useState<{source: string; target: string}[]>([]);
  const [showReplacements, setShowReplacements] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [showModelSelect, setShowModelSelect] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const settings = useSettingsStore((state) => state.settings);
  const aiRuntimeState = useAiRuntimeState();
  const testedModels = aiRuntimeState.testedModels || {};

  useEffect(() => {
    if (videoId) loadSubtitle();
    aiRuntimeStateService.refresh();
  }, [videoId]);

  useEffect(() => {
    if (content) setSubtitles(parseSRT(content));
  }, [content]);

  const loadSubtitle = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getLocalFile(videoId, 'subtitle');
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
      await apiService.saveLocalFile(videoId, 'subtitle', newContent + '\n');
      setContent(newContent);
      setEditingIndex(null);
    } catch (err) {
      console.error('保存字幕失败:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditContent('');
  };

  const handleApplyTerms = async () => {
    setIsApplyingTerms(true);
    try {
      const response = await apiService.applyTermsToSubtitle(videoId, content);
      if (response.success && response.data) {
        setContent(response.data.content);
        setReplacements(response.data.replacements || []);
      }
    } catch (err) {
      console.error('术语替换失败:', err);
    } finally {
      setIsApplyingTerms(false);
    }
  };

  const getModelsForProvider = (providerId: string) => {
    return testedModels[providerId] || [];
  };

  const availableProviders = useMemo(() => {
    const providers = settings?.llm?.providers || [];
    return providers.filter((p) => testedModels[p.id]?.length > 0);
  }, [settings, testedModels]);

  // 初始化默认模型选择
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

  const handleAnalyzeClick = async () => {
    console.log('AI分析点击', { availableProviders: availableProviders.map(p => p.id), testedModels, selectedModels, selectedProvider });
    if (availableProviders.length === 0) {
      console.log('无可用供应商', { providers: settings?.llm?.providers?.map(p => p.id), testedModels });
      alert('请先在AI笔记设置页面验证AI模型');
      return;
    }
    // 如果没有选择模型，使用第一个可用的
    const providerToUse = selectedProvider || availableProviders[0]?.id;
    if (!providerToUse) {
      alert('请先选择AI模型');
      return;
    }
    handleAnalyzeWithModel(providerToUse, selectedModels[providerToUse]);
  };

  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{issues: any[]; summary: string} | null>(null);

  const handleAnalyzeWithModel = async (providerId: string, _modelName: string) => {
    console.log('开始AI分析', { providerId, content: content.substring(0, 100) });
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    try {
      const response = await apiService.analyzeSubtitle(videoId, content, providerId);
      console.log('AI分析结果', response);
      if (!response.success || response.data?.error) {
        setAnalysisError(response.data?.error || response.message || '分析失败');
      } else {
        setAnalysisResult({
          issues: response.data?.issues || [],
          summary: response.data?.summary || '',
        });
      }
    } catch (err) {
      console.error('AI分析失败:', err);
      setAnalysisError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setIsAnalyzing(false);
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
        <button onClick={loadSubtitle} style={{ padding: '8px 16px', background: 'var(--color-accent)', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>重试</button>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{scrollbarStyle}</style>
      
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
        
        {/* 开始分析按钮 */}
        <button
          onClick={handleAnalyzeClick}
          disabled={isAnalyzing || !content}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            background: isAnalyzing ? 'var(--color-bg-secondary)' : '#10b981',
            color: '#fff',
            border: 'none',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            opacity: isAnalyzing ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isAnalyzing ? '分析中...' : '开始分析'}
        </button>
        
        {/* 分析错误提示 */}
        {analysisError && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '8px 12px',
            zIndex: 100,
            maxWidth: '250px',
            fontSize: '12px',
            color: '#dc2626',
          }}>
            {analysisError}
            <button
              onClick={() => setAnalysisError(null)}
              style={{
                marginLeft: '8px',
                padding: '2px 6px',
                fontSize: '11px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#666',
              }}
            >
              ✕
            </button>
          </div>
        )}
        
        {/* 术语替换按钮 */}
        <button
          onClick={() => {
            if (replacements.length > 0) {
              setShowReplacements(!showReplacements);
            } else {
              handleApplyTerms();
            }
          }}
          disabled={isApplyingTerms || !content}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            background: isApplyingTerms ? 'var(--color-bg-secondary)' : '#8b5cf6',
            color: '#fff',
            border: 'none',
            cursor: isApplyingTerms ? 'not-allowed' : 'pointer',
            opacity: isApplyingTerms ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isApplyingTerms ? '...' : replacements.length > 0 ? `已替换${replacements.length}处` : '术语替换'}
        </button>

        {/* 替换记录弹窗 */}
        {showReplacements && replacements.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '80px',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '12px',
            zIndex: 100,
            maxWidth: '300px',
            maxHeight: '200px',
            overflow: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              术语替换记录
            </div>
            {replacements.map((r, i) => (
              <div key={i} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ color: '#ef4444' }}>{r.source}</span>
                <span style={{ color: 'var(--color-text-tertiary)', margin: '0 4px' }}>→</span>
                <span style={{ color: '#22c55e' }}>{r.target}</span>
              </div>
            ))}
            <button
              onClick={() => setShowReplacements(false)}
              style={{
                marginTop: '8px',
                padding: '4px 8px',
                fontSize: '11px',
                background: 'var(--color-bg-secondary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              关闭
            </button>
          </div>
        )}
        
        
      </div>

      {/* AI分析结果 */}
      {analysisResult && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>AI分析结果</span>
            <button
              onClick={() => setAnalysisResult(null)}
              style={{ padding: '4px 8px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          {analysisResult.summary && (
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
              {analysisResult.summary}
            </div>
          )}
          {analysisResult.issues && analysisResult.issues.length > 0 && (
            <div style={{ fontSize: '12px', color: '#f59e0b' }}>
              发现 {analysisResult.issues.length} 个问题
            </div>
          )}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
        <span>{subtitles.length} 条字幕</span>
        <span>双击字幕行编辑</span>
      </div>
    </div>
  );
}