import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../services/api';

interface Replacement {
  source: string;
  target: string;
  note: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (newContent: string) => void;
  content: string;
  videoId: string;
}

export default function TermReplacementModal({ isOpen, onClose, onApply, content, videoId }: Props) {
  const [termFiles, setTermFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [enabledReplacements, setEnabledReplacements] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const reset = useCallback(() => {
    setTermFiles([]);
    setSelectedFiles([]);
    setReplacements([]);
    setEnabledReplacements(new Set());
    setLoading(false);
    setApplying(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // 打开时加载术语库文件和预览
  useEffect(() => {
    if (!isOpen) return;
    reset();
    loadPreview();
  }, [isOpen]);

  const loadPreview = async (files?: string[]) => {
    setLoading(true);
    try {
      const response = await apiService.previewTermReplacements(content, files);
      if (response.success && response.data) {
        setReplacements(response.data);
        setEnabledReplacements(new Set(response.data.map((r: Replacement) => r.source)));
      }
      if (response.data?.files) {
        setTermFiles(response.data.files);
        setSelectedFiles(files || response.data.files);
      }
    } catch (err) {
      console.error('加载术语预览失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 切换术语库文件选择
  const toggleFile = (file: string) => {
    const newSelected = selectedFiles.includes(file)
      ? selectedFiles.filter(f => f !== file)
      : [...selectedFiles, file];
    setSelectedFiles(newSelected);
    // 重新预览
    loadPreview(newSelected.length > 0 ? newSelected : undefined);
  };

  // 切换单个替换项
  const toggleReplacement = (source: string) => {
    const next = new Set(enabledReplacements);
    if (next.has(source)) {
      next.delete(source);
    } else {
      next.add(source);
    }
    setEnabledReplacements(next);
  };

  // 应用术语替换
  const handleApply = async () => {
    if (enabledReplacements.size === 0) return;
    setApplying(true);

    try {
      // 根据启用的替换项，手动执行替换
      const enabledList = replacements.filter(r => enabledReplacements.has(r.source));
      let newContent = content;

      for (const r of enabledList) {
        if (newContent.includes(r.source)) {
          // 只对文本行进行替换（跳过索引和时间戳）
          const lines = newContent.split('\n');
          newContent = lines.map(line => {
            const stripped = line.trim();
            if (!stripped || stripped.match(/^\d+$/) || stripped.includes('-->')) {
              return line;
            }
            return line.replace(new RegExp(r.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), r.target);
          }).join('\n');
        }
      }

      // 调用后端保存
      await apiService.saveLocalFile(videoId, 'subtitle', newContent);
      onApply(newContent);
      handleClose();
    } catch (err) {
      console.error('应用术语替换失败:', err);
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  const fileLabel = (filename: string): string => {
    switch (filename) {
      case 'custom.csv': return '自定义';
      case 'product.csv': return '产品/工具';
      case 'tech.csv': return '技术缩写';
      default: return filename.replace('.csv', '');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 520, maxHeight: '80vh',
          background: 'var(--color-bg-primary)',
          borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>术语替换</span>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* 术语库文件选择 */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>术语库文件</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {termFiles.map(file => {
              const checked = selectedFiles.includes(file);
              return (
                <label
                  key={file}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                    borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    background: checked ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
                    color: checked ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFile(file)}
                    style={{ accentColor: 'var(--color-accent)', margin: 0 }}
                  />
                  {fileLabel(file)}
                </label>
              );
            })}
          </div>
        </div>

        {/* 替换预览列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px', minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 8 }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>扫描中...</span>
            </div>
          ) : replacements.length > 0 ? (
            <>
              <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8, fontWeight: 500 }}>
                发现 {replacements.length} 处可替换
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {replacements.map((r, i) => {
                  const enabled = enabledReplacements.has(r.source);
                  return (
                    <div
                      key={i}
                      onClick={() => toggleReplacement(r.source)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        borderRadius: 8, cursor: 'pointer',
                        background: enabled ? 'transparent' : 'var(--color-bg-secondary)',
                        opacity: enabled ? 1 : 0.6,
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* 复选框 */}
                      <div style={{
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        border: enabled ? '2px solid #22c55e' : '2px solid var(--color-border)',
                        background: enabled ? '#22c55e' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {enabled && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </div>
                      {/* 替换内容 */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#ef4444', textDecoration: enabled ? 'none' : 'line-through', fontSize: 13 }}>{r.source}</span>
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>→</span>
                        <span style={{ color: '#22c55e', fontSize: 13 }}>{r.target}</span>
                      </div>
                      {/* 备注 */}
                      {r.note && (
                        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.note}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              当前字幕中没有需要替换的术语
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            已选 {enabledReplacements.size}/{replacements.length}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleClose}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
            >
              取消
            </button>
            {replacements.length > 0 && (
              <button
                onClick={handleApply}
                disabled={applying || enabledReplacements.size === 0}
                style={{
                  padding: '8px 20px', borderRadius: 8, fontSize: 13,
                  background: enabledReplacements.size > 0 ? '#8b5cf6' : 'var(--color-bg-secondary)',
                  color: enabledReplacements.size > 0 ? '#fff' : 'var(--color-text-tertiary)',
                  border: 'none', cursor: enabledReplacements.size > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                  opacity: applying ? 0.7 : 1,
                }}
              >
                {applying ? '替换中...' : '应用替换'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
