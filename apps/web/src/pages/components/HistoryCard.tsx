import { useNavigate } from 'react-router-dom';
import { Clock, X } from 'lucide-react';
import type { HistoryItem } from '../../stores/history';

interface HistoryCardProps {
  item: HistoryItem;
  onDelete: (id: string) => void;
}

// 格式化时间显示
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < week) return `${Math.floor(diff / day)}天前`;
  if (diff < month) return `${Math.floor(diff / week)}周前`;
  if (diff < year) return `${Math.floor(diff / month)}个月前`;
  return `${Math.floor(diff / year)}年前`;
};

export default function HistoryCard({ item, onDelete }: HistoryCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (item.type === 'video') {
      navigate(`/video/${item.id}`);
    } else if (item.type === 'opus') {
      navigate(`/opus/${item.id}`);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  };

  return (
    <article
      className="history-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`查看${item.type === 'video' ? '视频' : '图文'}：${item.title}`}
    >
      <div className="history-card-content">
        <div className="history-card-header">
          {/* 类型标签 */}
          <span className={`history-card-type ${item.type}`}>
            {item.type === 'video' ? '视频' : '图文'}
          </span>
          {/* 删除图标 */}
          <div
            className="history-card-delete-icon"
            onClick={handleDelete}
            role="button"
            tabIndex={0}
            aria-label="删除历史记录"
            title="删除"
          >
            <X size={14} />
          </div>
        </div>
        
        {/* 标题 */}
        <h3 className="history-card-title" title={item.title}>
          {item.title}
        </h3>
        
        {/* 时间 */}
        <div className="history-card-meta">
          <Clock size={12} />
          <span>{formatTimeAgo(item.timestamp)}</span>
        </div>
      </div>
    </article>
  );
}