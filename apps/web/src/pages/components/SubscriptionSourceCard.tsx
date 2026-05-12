import { useState, useEffect } from 'react'
import { FolderHeart, ListVideo, Plus, Download, RefreshCw, Check } from 'lucide-react'
import { apiService } from '../../services/api'
import { getAvatarProxyUrl } from '../../config/api'
import './SubscriptionSourceCard.css'

interface SubscriptionSource {
  id: string
  type: 'favorite_folder' | 'ugc_season'
  source_id: string
  title: string
  cover?: string
  media_count?: number
  upper?: {
    mid?: number
    name?: string
  }
  updated_at?: number
}

interface SubscriptionSourceStatus {
  status_type: 'not_added' | 'partial' | 'has_update' | 'complete'
  status_text: string
  total_count: number
  existing_count: number
  new_count: number
}

interface SubscriptionSourceCardProps {
  source: SubscriptionSource
  onClick: () => void
  onStatusChange?: () => void
}

const sourceTypeLabel = (type: 'favorite_folder' | 'ugc_season') =>
  type === 'favorite_folder' ? '订阅收藏夹' : '订阅合集'

export default function SubscriptionSourceCard({ source, onClick, onStatusChange }: SubscriptionSourceCardProps) {
  const [status, setStatus] = useState<SubscriptionSourceStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  // 获取订阅源状态
  useEffect(() => {
    fetchStatus()
  }, [source.id])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await apiService.getSubscriptionSourceStatus(source.type, source.source_id)
      if (response.success && response.data) {
        setStatus(response.data)
      }
    } catch (error) {
      console.error('[SubscriptionSourceCard] 获取状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToQueue = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      setAdding(true)
      const response = await apiService.addSubscriptionSourceToQueue(source.type, source.source_id)
      
      if (response.success) {
        // 刷新状态
        await fetchStatus()
        
        // 通知父组件状态已更改
        if (onStatusChange) {
          onStatusChange()
        }
      }
    } catch (error) {
      console.error('[SubscriptionSourceCard] 添加到队列失败:', error)
    } finally {
      setAdding(false)
    }
  }

  const getButtonContent = () => {
    if (adding) {
      return <RefreshCw size={16} className="animate-spin" />
    }

    if (!status) {
      return <Plus size={16} />
    }

    switch (status.status_type) {
      case 'not_added':
        return <Plus size={16} />
      case 'partial':
        return <Download size={16} />
      case 'has_update':
        return <RefreshCw size={16} />
      case 'complete':
        return <Check size={16} />
      default:
        return <Plus size={16} />
    }
  }

  const getButtonStyle = () => {
    if (!status) {
      return {}
    }

    switch (status.status_type) {
      case 'not_added':
        return {}
      case 'partial':
        return {
          backgroundColor: 'var(--color-warning-500)',
          color: 'var(--color-white)',
        }
      case 'has_update':
        return {
          backgroundColor: 'var(--color-info-500)',
          color: 'var(--color-white)',
        }
      case 'complete':
        return {
          backgroundColor: 'var(--color-success-500)',
          color: 'var(--color-white)',
        }
      default:
        return {}
    }
  }

  const getButtonTitle = () => {
    if (adding) {
      return '添加中...'
    }

    if (!status) {
      return '添加系列'
    }

    switch (status.status_type) {
      case 'not_added':
        return '添加系列'
      case 'partial':
        return `已添加 ${status.existing_count}/${status.total_count}`
      case 'has_update':
        return `有更新 +${status.new_count}`
      case 'complete':
        return '已完整'
      default:
        return '添加系列'
    }
  }

  const isButtonDisabled = adding || loading || status?.status_type === 'complete'

  return (
    <article
      className="fav-folder-item subscription-source-item"
      onClick={onClick}
      role="listitem"
      tabIndex={0}
    >
      <div className="fav-folder-cover">
        <div className="fav-folder-thumbnail subscription-source-thumbnail">
          {source.cover ? (
            <img 
              src={getAvatarProxyUrl(source.cover)} 
              alt={source.title} 
              className="w-full h-full object-cover" 
            />
          ) : source.type === 'favorite_folder' ? (
            <FolderHeart />
          ) : (
            <ListVideo />
          )}
        </div>
      </div>
      <div className="fav-folder-info">
        <h3>{source.title}</h3>
        <div className="fav-folder-meta">
          <span className="fav-folder-status public">{sourceTypeLabel(source.type)}</span>
          <span className="fav-folder-count">{source.media_count || 0}个视频</span>
          {source.upper?.name && <span className="fav-folder-count">{source.upper.name}</span>}
        </div>
      </div>
      <button
        className="subscription-source-add-btn"
        onClick={handleAddToQueue}
        disabled={isButtonDisabled}
        title={getButtonTitle()}
        style={{
          ...getButtonStyle(),
          opacity: isButtonDisabled && status?.status_type !== 'complete' ? 0.6 : 1,
          cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
        }}
        aria-label={getButtonTitle()}
      >
        {getButtonContent()}
      </button>
    </article>
  )
}
