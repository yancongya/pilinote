export type NavItem = { id: string; label: string }

export const NAV: NavItem[] = [
  { id: 'product', label: '产品' },
  { id: 'download', label: '下载' },
  { id: 'workflow', label: '工作流' },
  { id: 'features', label: '能力' },
  { id: 'gallery', label: '截图' },
  { id: 'faq', label: 'FAQ' },
  { id: 'docs', label: '文档' },
]

export type Feature = {
  title: string
  desc: string
  bullets: string[]
}

export const FEATURES: Feature[] = [
  {
    title: 'AI 笔记回跳',
    desc: '结构化总结关键点，时间戳贯穿全文，点击即可回到视频片段。',
    bullets: ['章节/问题/结论自动整理', '时间戳可点击回跳', '复习从翻视频变成看笔记'],
  },
  {
    title: '收藏夹杀手',
    desc: '同步收藏夹、稍后再看、历史记录与订阅文件夹，把堆积变成可处理队列。',
    bullets: ['增量扫描与去重', '同步数量和节奏可控', '待看内容自动进入工作流'],
  },
  {
    title: '自动下载落盘',
    desc: '队列调度、失败重试、分P处理，把视频和产物稳定保存到本地。',
    bullets: ['下载队列与重试', '分P/系列处理', '视频与产物同级归档'],
  },
  {
    title: '本地媒体库',
    desc: '统一浏览已下载媒体与 sidecar 文件，离线检索和复盘更稳定。',
    bullets: ['媒体、字幕、截图联动', '本地路径可迁移', '二刷和复盘更快'],
  },
  {
    title: '模型与策略可配置',
    desc: '模型、提示词、下载策略和自动化链路都可调整，适合长期使用和二开。',
    bullets: ['提示词与模型可调整', '链路日志可检查', '自动化策略可扩展'],
  },
]

export type WorkflowStep = {
  title: string
  desc: string
  meta: string
}

export const WORKFLOW: WorkflowStep[] = [
  { title: '选择视频源', desc: '收藏夹、稍后再看、观看历史、订阅文件夹四类来源，也支持手动解析链接。', meta: 'Sources' },
  { title: '添加到下载列表', desc: '手动添加、批量添加，或按 cron 设置自动扫描并加入下载列表。', meta: 'Cron + Manual' },
  { title: '下载落盘', desc: '队列按并发和速率策略处理，失败可重试，视频稳定保存到本地。', meta: 'Queue' },
  { title: '生成 sidecar', desc: '字幕、NFO、截图、缓存日志和笔记文件与媒体同级归档。', meta: 'Sidecars' },
  { title: 'AI 分析', desc: '基于字幕、简介和评论上下文构建 Prompt，生成章节、关键点和结论。', meta: 'AI Notes' },
  { title: '回跳复习', desc: '点击笔记时间戳回到视频片段，把待看内容变成可复习资料。', meta: 'Jump Back' },
]

export type Faq = { q: string; a: string }

export const FAQS: Faq[] = [
  {
    q: 'PiliNote 是给谁用的？',
    a: '给 B 站重度收藏/稍后再看/订阅的用户：你不缺视频，你缺的是“把堆积变成可复习的知识库”。',
  },
  {
    q: '数据存在哪里？',
    a: '视频和 sidecar 产物（字幕/NFO/截图/笔记等）都落在本地目录；路径可在设置中配置。',
  },
  {
    q: '离线可用吗？',
    a: '核心是本地管理与落盘；但获取在线内容与部分 AI 能力需要网络（以当前实现为准）。',
  },
  {
    q: '参考了哪些项目？',
    a: '本项目开发过程中参考了 BiliNote、bili-sync、BiliTools、PiliPala 等开源项目的思路与实现。',
  },
]
