import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiBaseUrl } from '../../config/api';
import { useToast } from '../Toast';

interface Issue {
  index: number;
  type: 'typo' | 'grammar' | 'term';
  text: string;
  suggestion: string;
}

interface PipelineStage {
  key: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: Record<string, any>;
}

const STAGE_DEFS = [
  { key: 'READ_NFO', label: '读取视频信息' },
  { key: 'SUBTITLE_OVERVIEW', label: '字幕概况' },
  { key: 'AI_ANALYZE', label: 'AI 修正分析' },
  { key: 'DONE', label: '完成' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  content: string;
  modelProvider: string;
  modelName?: string;
  onApplyFix: (issues: Issue[]) => void;
}

export default function SubtitleAnalysisModal({
  isOpen,
  onClose,
  videoId,
  content,
  modelProvider,
  modelName,
  onApplyFix,
}: Props) {
  const { showToast } = useToast();
  const [stages, setStages] = useState<PipelineStage[]>(
    STAGE_DEFS.map(d => ({ ...d, status: 'pending' as const }))
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [taskId, setTaskId] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStages(STAGE_DEFS.map(d => ({ ...d, status: 'pending' as const })));
    setIssues([]);
    setSummary('');
    setError('');
    setTaskId('');
  }, []);

  const handleCancel = useCallback(async () => {
    abortRef.current?.abort();
    if (taskId) {
      try {
        await fetch(`${getApiBaseUrl()}/api/ai/subtitle/cancel/${encodeURIComponent(taskId)}`, { method: 'POST' });
        showToast('已取消字幕分析任务', 'success');
      } catch {
        showToast('取消字幕分析失败', 'error');
      }
    } else {
      showToast('已停止当前字幕分析请求', 'info');
    }
    setIsRunning(false);
  }, [showToast, taskId]);

  const startAnalysis = useCallback(async () => {
    if (isRunning) return;
    reset();
    setIsRunning(true);
    showToast('已开始字幕分析', 'info');

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/ai/subtitle/pipeline-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          content,
          model_provider: modelProvider,
          model_name: modelName,
        }),
        signal: ac.signal,
      });

      if (!response.body) {
        throw new Error('无法建立连接');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const stageToastLabels: Record<string, string> = {
        READ_NFO: '视频信息读取完成',
        SUBTITLE_OVERVIEW: '字幕概况分析完成',
        AI_ANALYZE: 'AI 修正分析完成',
        DONE: '字幕分析完成',
      };

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
              setTaskId(data.task_id);
            }

            setStages(prev => prev.map(s => (s.key === stage ? { ...s, status, data } : s)));

            if (status === 'completed' && stageToastLabels[stage]) {
              showToast(stageToastLabels[stage], 'success');
            }

            if (stage === 'DONE' && status === 'completed') {
              setIssues(data?.issues || []);
              setSummary(data?.summary || '');
              setIsRunning(false);
              abortRef.current = null;
            }

            if (stage === 'DONE' && status === 'error') {
              const message = data?.error || '分析失败';
              setError(message);
              setIsRunning(false);
              abortRef.current = null;
              showToast(message, 'error');
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsRunning(false);
        abortRef.current = null;
        showToast('已取消字幕分析', 'info');
        return;
      }
      const message = err?.message || '连接失败';
      setError(message);
      setIsRunning(false);
      abortRef.current = null;
      showToast(message, 'error');
    }
  }, [content, isRunning, modelProvider, reset, showToast, videoId]);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      setIsRunning(false);
      reset();
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const isComplete = stages.some(s => s.key === 'DONE' && s.status === 'completed');
  const hasError = stages.some(s => s.status === 'error');

  const stageIcon = (status: PipelineStage['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        );
      case 'processing':
        return (
          <div style={{ width: 16, height: 16, border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        );
      case 'error':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        );
      default:
        return (
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--color-text-tertiary)' }} />
        );
    }
  };

  return (
    <div style={{ width: '100%', background: 'transparent', borderRadius: 0, border: 'none', overflow: 'visible' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 12px 0', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>AI 字幕分析</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {taskId && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{taskId.slice(0, 8)}</span>}
          <button
            type="button"
            onClick={handleCancel}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>当前模型</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{modelProvider}{modelName ? ` / ${modelName}` : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={startAnalysis}
            disabled={isRunning}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--color-accent)', color: '#fff', border: 'none', cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.6 : 1 }}
          >
            {isRunning ? '分析中...' : isComplete ? '重新分析' : '开始分析'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={!isRunning}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: 'none', cursor: !isRunning ? 'not-allowed' : 'pointer', opacity: !isRunning ? 0.6 : 1 }}
          >
            停止
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 0 8px', flexShrink: 0 }}>
        {stages.filter(s => s.key !== 'DONE').map((stage, i) => (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 2 ? 0 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                {stageIcon(stage.status)}
              </div>
              {i < 2 && (
                <div style={{ width: 2, height: 28, background: stage.status === 'completed' ? '#22c55e' : 'var(--color-border)', borderRadius: 1 }} />
              )}
            </div>

            <div style={{ flex: 1, paddingBottom: i < 2 ? 8 : 0, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: stage.status === 'pending' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', marginBottom: 2 }}>
                {stage.label}
                {stage.status === 'processing' && <span style={{ color: 'var(--color-accent)', marginLeft: 6 }}>分析中...</span>}
              </div>
              {stage.key === 'READ_NFO' && stage.data && (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  {stage.data.title && <div>标题: {stage.data.title}</div>}
                  {stage.data.studio && <div>UP主: {stage.data.studio}</div>}
                  {stage.data.runtime && <div>时长: {stage.data.runtime} 分钟</div>}
                </div>
              )}
              {stage.key === 'SUBTITLE_OVERVIEW' && stage.data && (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {stage.data.overview}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {(isComplete || hasError) && (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 0 8px', borderTop: '1px solid var(--color-border)' }}>
          {hasError && (
            <div style={{ fontSize: 13, color: '#ef4444', padding: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
              {error}
            </div>
          )}
          {isComplete && (
            <>
              {summary && (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5, padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                  {summary}
                </div>
              )}
              {issues.length > 0 ? (
                <div>
                  <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8, fontWeight: 500 }}>
                    发现 {issues.length} 个问题
                  </div>
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {issues.map((issue, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, borderBottom: '1px solid var(--color-border)' }}>
                        <span style={{
                          padding: '1px 6px', borderRadius: 3, fontSize: 10,
                          background: issue.type === 'typo' ? 'rgba(239,68,68,0.15)' : issue.type === 'grammar' ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)',
                          color: issue.type === 'typo' ? '#ef4444' : issue.type === 'grammar' ? '#f59e0b' : '#8b5cf6',
                        }}>
                          {issue.type === 'typo' ? '错字' : issue.type === 'grammar' ? '语法' : '术语'}
                        </span>
                        <span style={{ color: '#ef4444', textDecoration: 'line-through', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.text}</span>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
                        <span style={{ color: '#22c55e', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#22c55e', padding: 12, background: 'rgba(34,197,94,0.08)', borderRadius: 8, textAlign: 'center' }}>
                  字幕质量良好，未发现问题
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 0', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
        {isComplete && issues.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onApplyFix(issues);
              onClose();
            }}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            应用修正
          </button>
        )}
        {(isComplete || hasError || !isRunning) && (
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: 'none', cursor: 'pointer' }}
          >
            关闭
          </button>
        )}
      </div>
    </div>
  );
}
