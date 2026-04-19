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

export type AiNoteStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AiNotePipelineMode = 'video' | 'series' | 'image_text';

export interface AiNoteMeta {
  trace?: AiTraceStep[];
  pipeline_mode?: AiNotePipelineMode;
  [key: string]: any;
}

export interface NoteStatusResponse {
  success: boolean;
  note_id: string;
  status: AiNoteStatus;
  progress?: number;
  message?: string;
  error?: string;
  trace?: AiTraceStep[];
  control_state?: 'running' | 'paused' | 'cancelled' | 'completed';
  current_stage?: string;
}

export interface NoteResponse {
  success: boolean;
  id: string;
  video_id?: string;
  content?: string;
  summary?: string;
  style?: string;
  formats?: string[];
  pipeline_mode?: AiNotePipelineMode;
  status: AiNoteStatus | 'not_found';
  model_provider?: string;
  model_name?: string;
  error?: string;
  meta?: AiNoteMeta;
  generated_markdown_path?: string;
  control_state?: 'running' | 'paused' | 'cancelled' | 'completed';
  current_stage?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface NoteLookupResponse {
  success: boolean;
  found: boolean;
  note: NoteResponse | null;
  message?: string;
}

export interface AiTraceStep {
  stage: string;
  title: string;
  summary: string;
  detail?: Record<string, any>;
  progress?: number;
  ts?: string;
}

export interface AiNoteTraceStageTemplate {
  stage: string;
  title: string;
  shortLabel: string;
}

export const AI_NOTE_TRACE_STAGE_TEMPLATES: Record<AiNotePipelineMode, AiNoteTraceStageTemplate[]> = {
  video: [
    { stage: 'AUDIO.FETCH', title: '音频', shortLabel: '音频' },
    { stage: 'SUBTITLE.GENERATE', title: '字幕生成', shortLabel: '字幕' },
    { stage: 'NFO.READ', title: 'NFO 读取', shortLabel: 'NFO' },
    { stage: 'PROMPT.BUILD', title: 'Prompt 构建', shortLabel: 'Prompt' },
    { stage: 'LLM.ANALYZE', title: 'AI 分析', shortLabel: 'AI' },
    { stage: 'CONTENT.GENERATE', title: '生成内容', shortLabel: '生成' },
    { stage: 'DONE', title: '完成', shortLabel: '完成' },
    { stage: 'ERROR', title: '错误', shortLabel: '错误' },
  ],
  series: [
    { stage: 'AUDIO.FETCH', title: '番剧信息', shortLabel: '获取' },
    { stage: 'SUBTITLE.GENERATE', title: '分集与转写', shortLabel: '转写' },
    { stage: 'NFO.READ', title: 'NFO 读取', shortLabel: 'NFO' },
    { stage: 'PROMPT.BUILD', title: 'Prompt 构建', shortLabel: 'Prompt' },
    { stage: 'LLM.ANALYZE', title: 'AI 分析', shortLabel: 'AI' },
    { stage: 'CONTENT.GENERATE', title: '生成内容', shortLabel: '生成' },
    { stage: 'DONE', title: '完成', shortLabel: '完成' },
    { stage: 'ERROR', title: '错误', shortLabel: '错误' },
  ],
  image_text: [
    { stage: 'AUDIO.FETCH', title: '图片识别', shortLabel: '识别' },
    { stage: 'SUBTITLE.GENERATE', title: '文字提取', shortLabel: '提取' },
    { stage: 'NFO.READ', title: '读取', shortLabel: '读取' },
    { stage: 'PROMPT.BUILD', title: 'Prompt 构建', shortLabel: 'Prompt' },
    { stage: 'LLM.ANALYZE', title: 'AI 分析', shortLabel: 'AI' },
    { stage: 'CONTENT.GENERATE', title: '生成内容', shortLabel: '生成' },
    { stage: 'DONE', title: '完成', shortLabel: '完成' },
    { stage: 'ERROR', title: '错误', shortLabel: '错误' },
  ],
}

export const aiNoteService = {
  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const response = await apiService.request<AnalyzeResponse>('/api/note/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return (response.data ?? response) as AnalyzeResponse;
  },

  async getStatus(noteId: string): Promise<NoteStatusResponse> {
    const response = await apiService.request<NoteStatusResponse>(`/api/note/status/${noteId}`);
    return (response.data ?? response) as NoteStatusResponse;
  },

  async getNote(noteId: string): Promise<NoteResponse> {
    const response = await apiService.request<NoteResponse>(`/api/note/${noteId}`);
    return (response.data ?? response) as NoteResponse;
  },

  async lookupNoteByVideo(videoId: string): Promise<NoteLookupResponse> {
    const response = await apiService.request<NoteLookupResponse>(`/api/note/by-video?video_id=${encodeURIComponent(videoId)}`);
    return (response.data ?? response) as NoteLookupResponse;
  },

  async getNoteByVideo(videoId: string): Promise<NoteResponse | null> {
    const payload = await this.lookupNoteByVideo(videoId);
    return payload.found ? payload.note : null;
  },

  async pauseNote(noteId: string): Promise<{ success: boolean; message?: string }> {
    const response = await apiService.request<{ success: boolean; message?: string }>(`/api/note/pause/${encodeURIComponent(noteId)}`, {
      method: 'POST',
    });
    return (response.data ?? response) as { success: boolean; message?: string };
  },

  async resumeNote(noteId: string): Promise<{ success: boolean; message?: string }> {
    const response = await apiService.request<{ success: boolean; message?: string }>(`/api/note/resume/${encodeURIComponent(noteId)}`, {
      method: 'POST',
    });
    return (response.data ?? response) as { success: boolean; message?: string };
  },

  async resumeFromStage(
    noteId: string,
    resumeFromStage: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await apiService.request<{ success: boolean; message?: string }>(
      `/api/note/resume-from-stage/${encodeURIComponent(noteId)}`,
      {
        method: 'POST',
        body: JSON.stringify({ resume_from_stage: resumeFromStage }),
      },
    );
    return (response.data ?? response) as { success: boolean; message?: string };
  },

  async cancelNote(noteId: string): Promise<{ success: boolean; message?: string }> {
    const response = await apiService.request<{ success: boolean; message?: string }>(`/api/note/cancel/${encodeURIComponent(noteId)}`, {
      method: 'POST',
    });
    return (response.data ?? response) as { success: boolean; message?: string };
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
  { label: '目录', value: 'toc', description: '高级功能预留：自动生成目录' },
  { label: '原片跳转', value: 'link', description: '高级功能预留：添加时间戳跳转' },
  { label: '原片截图', value: 'screenshot', description: '高级功能预留：插入关键帧截图' },
  { label: 'AI 总结', value: 'summary', description: '默认启用：末尾添加 AI 总结' },
] as const;

export const DEFAULT_STYLE = 'detailed';
export const DEFAULT_FORMATS = ['summary'];
