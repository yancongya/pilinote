import { defineConfig } from 'vitepress'
import fs from 'node:fs'
import path from 'node:path'

function posixJoin(...parts: string[]) {
  return parts.join('/').replace(/\/+/g, '/')
}

function existsFile(p: string) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

type SidebarLinkItem = { text: string; link: string }
type SidebarGroupItem = { text: string; items: SidebarItem[]; collapsed?: boolean }
type SidebarItem = SidebarLinkItem | SidebarGroupItem

function fileTitleFromName(name: string) {
  return name.replace(/\.md$/i, '')
}

const DIR_TRANSLATION: Record<string, string> = {
  'ai-note': 'AI 笔记',
  api: 'API',
  architecture: '架构',
  auth: '认证',
  base: '基础',
  components: '组件',
  database: '数据库',
  dev: '开发',
  download: '下载',
  metadata: '元数据',
  packaging: '打包发布',
  settings: '设置',
  'video-sources': '视频源',
  web: 'Web',
}

type FileMap = Record<string, string>

function mergeFileMaps(maps: FileMap[]): FileMap {
  return Object.assign({}, ...maps)
}

const FILE_TRANSLATION_ROOT: FileMap = {
  'ai-note-comparison': 'AI 笔记对比',
  'ai-subtitle-correction': 'AI 字幕校正',
  'cache-mechanism': '缓存机制',
  'design-system': '设计系统',
  index: '索引',
  'interaction-feedback': '交互反馈',
}

const FILE_TRANSLATION: FileMap = mergeFileMaps([
  FILE_TRANSLATION_ROOT,
  {
    endpoints: '端点列表',
    'favorites-api': '收藏夹 API',
    'history-api': '历史记录 API',
    'library-api': '本地视频库 API',
    'watchlater-api': '稍后再看 API',
  },
  {
    system: '系统架构',
    'backend-architecture': '后端架构',
    'concurrency-control': '并发控制',
    'error-classification': '错误分类',
    'frontend-architecture': '前端架构',
  },
  {
    cookies: 'Cookie 管理',
    'login-flow': '登录流程',
    'multi-account': '多账号管理',
    'wbi-sign': 'WBI 签名',
  },
  {
    'project-overview': '项目概述',
    'reference-projects': '参考项目',
    'tech-stack': '技术栈',
  },
  {
    'ai-note-modal': 'AiNoteModal 组件',
    'ai-note-model': 'AiNote 数据模型',
    'ai-note-panel': 'AiNotePanel 详情页面板',
    'ai-note-service': 'AiNoteService 分析服务',
    'alert-modal': 'AlertModal 警告弹窗',
    'batch-actions-bar': 'BatchActionsBar 批量操作栏',
    'bilibili-service': 'BilibiliService 服务',
    'confirm-modal': 'ConfirmModal 确认弹窗',
    'cookie-manager': 'CookieManager 管理',
    'download-engine': 'DownloadEngine 引擎',
    'download-manager': 'DownloadManager 管理',
    'download-service': 'DownloadService 服务',
    'favorites-data-transformer': '收藏夹数据转换',
    'headers-manager': 'HeadersManager 请求头',
    'history-list': 'HistoryList 历史记录',
    'home-content': 'HomeContent 首页',
    'llm-client': 'LLM 客户端',
    'main-layout': 'MainLayout 主布局',
    'media-data-transformer': 'MediaDataTransformer',
    'media-list-shell': 'MediaListShell 视频列表壳',
    'media-list-topbar': 'MediaListTopBar 导航筛选条',
    'media-processor': 'MediaProcessor 处理器',
    modal: 'Modal 弹窗',
    'new-download': 'NewDownload 下载页',
    'prompt-builder': 'Prompt 构建器',
    'scan-service': 'ScanService 扫描服务',
    'screenshot-service': 'ScreenshotService 截图',
    'settings-service': 'SettingsService 设置服务',
    toast: 'Toast 提示',
    'toview-data-transformer': '稍后再看数据转换',
    'transcriber-service': 'TranscriberService 转写',
    'video-cache-service': 'VideoCacheService 缓存',
    'video-classifier': 'VideoClassifier 分类器',
    'video-detail-page': 'VideoDetailPage 详情',
    'video-library': 'VideoLibrary 媒体库',
    'video-list-container': 'VideoListContainer 容器',
    'video-list-controls': 'VideoListControls 控件',
  },
  {
    'database-architecture': '数据库架构',
    models: '数据模型',
    schemas: 'API Schema',
  },
  {
    'dev-log': '开发日志',
    roadmap: '路线图',
  },
  {
    'add-to-download-queue': '添加到下载队列',
    'automation-features': '自动化功能',
    'comment-extraction': '评论提取',
    'favorites-download': '收藏夹下载',
    handlers: '文件处理器',
    queue: '队列系统',
    scheduler: '调度器',
    'system-refactor': '系统整合优化',
    tasks: '任务系统',
    'watchlater-download': '稍后再看下载',
  },
  {
    'nfo-format': 'NFO 格式',
  },
  {
    'desktop-installers': '安装包打包与脚本说明',
  },
  {
    accounts: '账号设置',
    'auto-download': '自动下载设置',
    backup: '备份设置',
    download: '下载设置',
    general: '通用设置',
    storage: '存储设置',
  },
  {
    favorites: '收藏夹',
    history: '观看历史',
    'link-parser': '链接解析',
    watchlater: '稍后再看',
  },
  {
    'downloads-list': '下载列表页',
    'favorites-page': '收藏页前端',
    'recent-updates': '最近更新',
    'theme-system': '主题系统',
    'watchlater-page': '稍后再看页前端',
  },
])

const FILE_TRANSLATION_DIR: Record<string, FileMap> = {
  api: { implementation: '后端实现' },
  download: { 'nfo-format': 'NFO 文件格式', 'media-type-support': '媒体类型支持' },
  settings: { 'video-library': '视频库设置' },
  web: { implementation: '前端实现' },
}

function translateDir(dir: string): string {
  return DIR_TRANSLATION[dir] ?? dir
}

function translateFile(name: string, dir?: string): string {
  if (dir) {
    const dirMap = FILE_TRANSLATION_DIR[dir]
    if (dirMap && name in dirMap) return dirMap[name]
  }
  return FILE_TRANSLATION[name] ?? name
}

function listMarkdownFiles(dir: string) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

function listDevSidebar() {
  const baseDir = path.resolve(__dirname, '..', 'docs-dev')
  const items: SidebarItem[] = []

  items.push({ text: '总览', link: '/dev/README' })

  const entries = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  for (const dir of entries) {
    const dirPath = path.join(baseDir, dir)
    const sectionItems: SidebarItem[] = []

    const readme = path.join(dirPath, 'README.md')
    if (existsFile(readme)) {
      sectionItems.push({ text: 'README', link: posixJoin('/dev', dir, 'README') })
    }

    const mdFiles = listMarkdownFiles(dirPath)
    for (const f of mdFiles) {
      sectionItems.push({ text: translateFile(fileTitleFromName(f), dir), link: posixJoin('/dev', dir, fileTitleFromName(f)) })
    }

    if (sectionItems.length) {
      items.push({ text: translateDir(dir), items: sectionItems, collapsed: true })
    }
  }

  const rootMdFiles = listMarkdownFiles(baseDir)
  if (rootMdFiles.length) {
    items.push({
      text: '其它',
      collapsed: true,
      items: rootMdFiles.map((f) => ({ text: translateFile(fileTitleFromName(f)), link: posixJoin('/dev', fileTitleFromName(f)) }))
    })
  }

  return items
}

function listGuideSidebar() {
  const baseDir = path.resolve(__dirname, '..', 'docs-guide')
  const items: SidebarItem[] = []
  items.push({ text: '总览', link: '/guide/README' })

  const entries = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  for (const dir of entries) {
    const dirPath = path.join(baseDir, dir)
    const sectionItems: SidebarItem[] = []

    const readme = path.join(dirPath, 'README.md')
    if (existsFile(readme)) {
      sectionItems.push({ text: 'README', link: posixJoin('/guide', dir, 'README') })
    }

    const mdFiles = listMarkdownFiles(dirPath)
    for (const f of mdFiles) {
      sectionItems.push({ text: fileTitleFromName(f), link: posixJoin('/guide', dir, fileTitleFromName(f)) })
    }

    if (sectionItems.length) {
      items.push({ text: dir, items: sectionItems, collapsed: true })
    }
  }

  const rootMdFiles = listMarkdownFiles(baseDir)
  if (rootMdFiles.length) {
    items.push({
      text: '其它',
      collapsed: true,
      items: rootMdFiles.map((f) => ({ text: fileTitleFromName(f), link: posixJoin('/guide', fileTitleFromName(f)) }))
    })
  }

  return items
}

export default defineConfig({
  title: 'PiliNote',
  description: '视频下载与AI笔记',
  cleanUrls: true,
  rewrites: {
    'docs-dev/:rest*': 'dev/:rest*',
    'docs-guide/:rest*': 'guide/:rest*'
  },
  themeConfig: {
    logo: '/brand/logo.png',
    nav: [
      { text: '落地页', link: '/' },
      { text: '开发文档', link: '/dev/' },
      { text: '使用指南', link: '/guide/' }
    ],
    sidebar: {
      '/dev/': listDevSidebar(),
      '/guide/': listGuideSidebar()
    }
  }
})
