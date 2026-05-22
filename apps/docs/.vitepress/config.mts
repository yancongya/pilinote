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

function listDevSidebar() {
  const baseDir = path.resolve(__dirname, '..', 'docs-dev')
  const items: Array<{ text: string; link: string }> = []

  // Root entry
  items.push({ text: '总览', link: '/dev/README' })

  // Top-level directories become sections
  const entries = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  for (const dir of entries) {
    const readme = path.join(baseDir, dir, 'README.md')
    if (existsFile(readme)) {
      items.push({ text: dir, link: posixJoin('/dev', dir, 'README') })
    }
  }

  // Root md files (non-README) as extra pages
  const rootFiles = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  if (rootFiles.length) {
    items.push({ text: '---', link: '/dev/README' })
    for (const f of rootFiles) {
      const name = f.replace(/\.md$/, '')
      items.push({ text: name, link: posixJoin('/dev', name) })
    }
  }

  return items
}

function listGuideSidebar() {
  const baseDir = path.resolve(__dirname, '..', 'docs-guide')
  const items: Array<{ text: string; link: string }> = []
  items.push({ text: '总览', link: '/guide/README' })

  const entries = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  for (const dir of entries) {
    const readme = path.join(baseDir, dir, 'README.md')
    if (existsFile(readme)) {
      items.push({ text: dir, link: posixJoin('/guide', dir, 'README') })
    }
  }

  const rootFiles = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  if (rootFiles.length) {
    items.push({ text: '---', link: '/guide/README' })
    for (const f of rootFiles) {
      const name = f.replace(/\.md$/, '')
      items.push({ text: name, link: posixJoin('/guide', name) })
    }
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
