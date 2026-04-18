export interface PromptTemplateMeta {
  key: string
  title: string
  category: string
  path: string[]
  kind: 'text' | 'lines'
}

export const PROMPT_TEMPLATE_CARDS: PromptTemplateMeta[] = [
  { key: 'base.system', title: '系统提示词', category: '基础', path: ['base', 'system'], kind: 'text' },
  { key: 'base.final', title: '最终要求', category: '基础', path: ['base', 'final'], kind: 'lines' },
  { key: 't0', title: 'T0 视频信息', category: '分层', path: ['layers', 't0'], kind: 'text' },
  { key: 't1', title: 'T1 视频文本', category: '分层', path: ['layers', 't1'], kind: 'text' },
  { key: 't2.simple', title: 'T2 简单', category: '分层', path: ['layers', 't2', 'simple'], kind: 'text' },
  { key: 't2.detailed', title: 'T2 详细', category: '分层', path: ['layers', 't2', 'detailed'], kind: 'text' },
  { key: 't3.academic', title: 'T3 学术', category: '风格', path: ['layers', 't3', 'academic'], kind: 'text' },
  { key: 't3.tutorial', title: 'T3 教程', category: '风格', path: ['layers', 't3', 'tutorial'], kind: 'text' },
  { key: 't3.xiaohongshu', title: 'T3 小红书', category: '风格', path: ['layers', 't3', 'xiaohongshu'], kind: 'text' },
  { key: 't3.life_journal', title: 'T3 生活向', category: '风格', path: ['layers', 't3', 'life_journal'], kind: 'text' },
  { key: 't3.task_oriented', title: 'T3 任务导向', category: '风格', path: ['layers', 't3', 'task_oriented'], kind: 'text' },
  { key: 't3.business', title: 'T3 商业风格', category: '风格', path: ['layers', 't3', 'business'], kind: 'text' },
  { key: 't3.meeting_minutes', title: 'T3 会议纪要', category: '风格', path: ['layers', 't3', 'meeting_minutes'], kind: 'text' },
  { key: 'formats.toc', title: '目录', category: '格式', path: ['layers', 'formats', 'toc'], kind: 'text' },
  { key: 'formats.link', title: '原片跳转', category: '格式', path: ['layers', 'formats', 'link'], kind: 'text' },
  { key: 'formats.screenshot', title: '原片截图', category: '格式', path: ['layers', 'formats', 'screenshot'], kind: 'text' },
  { key: 'formats.summary', title: 'AI 总结', category: '格式', path: ['layers', 'formats', 'summary'], kind: 'text' },
]

