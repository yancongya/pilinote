import { apiService } from './api';

export interface AnalyzeRequest {
  video_id: string;
  style?: string;
  formats?: string[];
  model_provider?: string;
  model_name?: string;
  extras?: string;
}

export interface AnalyzeResponse {
  note_id: string;
  status: string;
  success: boolean;
  message?: string;
}

export interface NoteStatusResponse {
  success: boolean;
  note_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
}

export interface NoteResponse {
  success: boolean;
  id: string;
  video_id?: string;
  content?: string;
  summary?: string;
  style?: string;
  formats?: string[];
  status: string;
  model_provider?: string;
  model_name?: string;
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export const aiNoteService = {
  async analyze(request: AnalyzeRequest): Promise<any> {
    const response = await apiService.request<any>('/api/note/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.data || response;
  },

  async getStatus(noteId: string): Promise<any> {
    const response = await apiService.request<any>(`/api/note/status/${noteId}`);
    return response.data || response;
  },

  async getNote(noteId: string): Promise<any> {
    const response = await apiService.request<any>(`/api/note/${noteId}`);
    return response.data || response;
  },

  async getNoteByVideo(videoId: string): Promise<any> {
    try {
      const response = await apiService.request<any>(`/api/note/by-video/${videoId}`);
      return response.data || response;
    } catch (error: any) {
      // 404 表示没有笔记，这是正常情况
      if (error?.status === 404 || error?.response?.status === 404) {
        return { success: true, content: null, status: 'not_found' };
      }
      throw error;
    }
  },
};

export const NOTE_STYLES = [
  { label: '精简', value: 'minimal', description: '仅记录最重要的内容' },
  { label: '详细', value: 'detailed', description: '包含完整内容和详细讨论' },
  { label: '学术', value: 'academic', description: '正式结构化，适合学术报告' },
  { label: '教程', value: 'tutorial', description: '详细记录关键点和结论' },
  { label: '小红书', value: 'xiaohongshu', description: '爆款标题、emoji 表达' },
  { label: '生活向', value: 'life_journal', description: '情感化表达，记录生活感悟' },
  { label: '任务导向', value: 'task_oriented', description: '强调任务和目标' },
  { label: '商业风格', value: 'business', description: '正式精准，适合商业报告' },
  { label: '会议纪要', value: 'meeting_minutes', description: '突出决策和行动项' },
] as const;

export const NOTE_FORMATS = [
  { label: '目录', value: 'toc', description: '自动生成目录' },
  { label: '原片跳转', value: 'link', description: '添加时间戳跳转' },
  { label: '原片截图', value: 'screenshot', description: '插入关键帧截图' },
  { label: 'AI 总结', value: 'summary', description: '末尾添加 AI 总结' },
] as const;

export const DEFAULT_STYLE = 'detailed';
export const DEFAULT_FORMATS = ['summary'];