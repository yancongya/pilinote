# 卡片组件设计 (VideoCard)

- 目标：提供一个统一、可复用的视频卡片组件接口，适配 Watch Later 与 收藏夹的数据。前端复用，后端保持数据规范。
- 数据模型（CardData）:
- id: string | number
- title: string
- cover: string
- duration: number
- pubtime: number | string
- view: number
- danmaku: number
- comment: number
- like: number
- coin: number
- favorite: number
- share: number
- uploader: { mid: number, name: string, face: string }
- 组件结构建议
  - Card container
  - Image cover
  - Title 行
  - Metadata 行（watch count、danmaku、pubtime 等）
  - Uploader 区域
- 风格与交互
  - 支持响应式布局，优先移动端设计
  - 交互动效尽量简洁，避免过多嵌套
- 数据降维与安全
  - 服务器端返回的字段必须经过清洗，前端只渲染确定已有字段

后续可把模板迁移到具体页面实现中，确保 Watch Later 与 收藏页外观一致性。
