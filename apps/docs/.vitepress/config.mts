import { defineConfig } from 'vitepress'

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
      '/dev/': [
        { text: '开发文档', link: '/dev/README' }
      ],
      '/guide/': [
        { text: '使用指南', link: '/guide/README' }
      ]
    }
  }
})
