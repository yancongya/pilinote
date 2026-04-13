import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HistoryItem {
  id: string; // bvid 或 opusId
  type: 'video' | 'opus'; // 媒体类型
  title: string; // 标题
  cover: string; // 封面URL
  duration: number; // 时长（秒）
  uploader: string; // UP主名称
  uploader_mid: number; // UP主 ID
  timestamp: number; // 添加时间戳
  view_count?: number; // 播放量（可选）
  danmaku_count?: number; // 弹幕数（可选）
}

interface HistoryState {
  history: HistoryItem[];
  maxHistorySize: number;

  // Actions
  addToHistory: (item: HistoryItem) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  getHistory: () => HistoryItem[];
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      maxHistorySize: 20,

      addToHistory: (item) => {
        const { history, maxHistorySize } = get();

        // 检查是否已存在
        const existingIndex = history.findIndex((h) => h.id === item.id);

        let newHistory: HistoryItem[];

        if (existingIndex !== -1) {
          // 如果已存在，更新时间戳并移到最前
          newHistory = [
            { ...item, timestamp: Date.now() },
            ...history.filter((_, i) => i !== existingIndex),
          ];
        } else {
          // 如果不存在，添加到列表头部
          newHistory = [{ ...item, timestamp: Date.now() }, ...history];
        }

        // 检查是否超过最大数量，删除最旧的
        if (newHistory.length > maxHistorySize) {
          newHistory = newHistory.slice(0, maxHistorySize);
        }

        set({ history: newHistory });
      },

      removeFromHistory: (id) => {
        const { history } = get();
        const newHistory = history.filter((h) => h.id !== id);
        set({ history: newHistory });
      },

      clearHistory: () => {
        set({ history: [] });
      },

      getHistory: () => {
        return get().history;
      },
    }),
    {
      name: 'pilinote-history',
    }
  )
);