import { Clock, Trash2 } from 'lucide-react';
import { useHistoryStore } from '../../stores/history';
import HistoryCard from './HistoryCard';
import ConfirmModal from '../../components/ConfirmModal';
import { useState } from 'react';

export default function HistoryList() {
  const history = useHistoryStore((state) => state.history);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const removeFromHistory = useHistoryStore((state) => state.removeFromHistory);
  const [showClearModal, setShowClearModal] = useState(false);

  const handleClearAll = () => {
    clearHistory();
    setShowClearModal(false);
  };

  if (history.length === 0) {
    return (
      <div className="history-list-empty">
        <Clock size={48} color="#999" />
        <p className="history-list-empty-title">暂无浏览历史</p>
        <p className="history-list-empty-desc">解析链接后会自动记录在这里</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      <div className="history-list-header">
        <h2 className="history-list-title">浏览历史</h2>
        <span className="history-list-count">{history.length} 条记录</span>
      </div>

      <div className="history-list-grid">
        {history.map((item) => (
          <HistoryCard
            key={item.id}
            item={item}
            onDelete={removeFromHistory}
          />
        ))}
      </div>

      {history.length > 0 && (
        <div className="history-list-actions">
          <button
            className="history-list-clear-btn"
            onClick={() => setShowClearModal(true)}
            aria-label="清空所有历史记录"
          >
            <Trash2 size={16} />
            清空历史
          </button>
        </div>
      )}

      {/* 清空确认对话框 */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearAll}
        title="清空浏览历史"
        message="确定要清空所有浏览历史记录吗？此操作不可恢复。"
        confirmText="清空"
        cancelText="取消"
        confirmVariant="danger"
      />
    </div>
  );
}