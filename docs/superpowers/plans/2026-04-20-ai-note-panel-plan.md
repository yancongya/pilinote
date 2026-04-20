# AI笔记详情面板实现计划

> **For agentic workers:** 需使用 superpowers:subagent-driven-development 执行此计划

**Goal:** 在视频详情页 `/video/:videoId` 下新增 `/ai` 子路由，提供字幕、笔记、思维导图的查看和编辑功能

**Architecture:** React Router 嵌套路由 + 3个Tab面板

**Tech Stack:** React, markmap, React Router

---

## Task 1: 安装 markmap 依赖

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: 添加 markmap 依赖**

```bash
cd apps/web && pnpm add markmap
```

---

## Task 2: 创建 AI笔记面板组件目录结构

**Files:**
- Create: `apps/web/src/pages/components/AiNotePanel/index.tsx`
- Create: `apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx`
- Create: `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- Create: `apps/web/src/pages/components/AiNotePanel/MindMapTab.tsx`

- [ ] **Step 1: 创建主入口组件**

```tsx
// apps/web/src/pages/components/AiNotePanel/index.tsx
import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';

type TabType = 'subtitle' | 'note' | 'mindmap';

export default function AiNotePanel() {
  const { videoId } = useParams<{ videoId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('subtitle');
  
  const tabs = [
    { id: 'subtitle' as TabType, label: '字幕' },
    { id: 'note' as TabType, label: '笔记' },
    { id: 'mindmap' as TabType, label: '思维导图' },
  ];
  
  // 找到视频目录路径
  const videoDir = getVideoDir(videoId);
  
  return (
    <div className="ai-note-panel">
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="tab-content">
        {activeTab === 'subtitle' && <TranscriptTab videoDir={videoDir} />}
        {activeTab === 'note' && <NoteTab videoDir={videoDir} />}
        {activeTab === 'mindmap' && <MindMapTab videoDir={videoDir} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建字幕Tab组件**

```tsx
// apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx
import { useState, useEffect } from 'react';
import { fsService } from '../../services/fs';

interface TranscriptTabProps {
  videoDir: string;
}

export function TranscriptTab({ videoDir }: TranscriptTabProps) {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  useEffect(() => {
    // 读取srt文件
    loadSubtitle();
  }, [videoDir]);
  
  const loadSubtitle = async () => {
    const files = await fsService.readDir(videoDir);
    const srtFile = files.find(f => f.endsWith('.srt'));
    if (srtFile) {
      const content = await fsService.readFile(srtFile);
      setContent(content);
    }
  };
  
  const saveSubtitle = async () => {
    // 保存到文件
  };
  
  return (
    <div className="transcript-tab">
      {isEditing ? (
        <textarea value={content} onChange={e => setContent(e.target.value)} />
      ) : (
        <pre>{content}</pre>
      )}
      <button onClick={() => isEditing ? saveSubtitle() : setIsEditing(true)}>
        {isEditing ? '保存' : '编辑'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 创建笔记Tab组件**

```tsx
// apps/web/src/pages/components/AiNotePanel/NoteTab.tsx
export function NoteTab({ videoDir }: { videoDir: string }) {
  // 读取 .ai-note.md 文件
  // Markdown渲染显示
  // 编辑保存功能
}
```

- [ ] **Step 4: 创建思维导图Tab组件**

```tsx
// apps/web/src/pages/components/AiNotePanel/MindMapTab.tsx
import { useEffect, useState, useRef } from 'react';
import { Markmap } from 'markmap';

export function MindMapTab({ videoDir }: { videoDir: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [markdown, setMarkdown] = useState('');
  
  useEffect(() => {
    // 读取md文件，提取标题生成导图
    loadMarkdown().then(setMarkdown);
  }, [videoDir]);
  
  useEffect(() => {
    if (svgRef.current && markdown) {
      Markmap.create(svgRef.current, {}, markdown);
    }
  }, [markdown]);
  
  return <svg ref={svgRef} />;
}
```

---

## Task 3: 添加嵌套路由

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: 添加路由配置**

```tsx
// App.tsx 添加
import AiNotePanel from './pages/components/AiNotePanel';

<Route path="/video/:videoId" element={<VideoDetailPage />}>
  <Route path="ai" element={<AiNotePanel />}>
    <Route index element={<Navigate to="subtitle" replace />} />
    <Route path="subtitle" element={<TranscriptTab />} />
    <Route path="note" element={<NoteTab />} />
    <Route path="mindmap" element={<MindMapTab />} />
  </Route>
</Route>
```

需要修改 VideoDetailPage 为 Outlet 布局

```tsx
// VideoDetailPage.tsx
import { Outlet } from 'react-router-dom';

export default function VideoDetailPage() {
  return (
    <div className="video-detail-page">
      {/* 现有内容 */}
      <Outlet />
    </div>
  );
}
```

---

## Task 4: 添加文件服务读取

**Files:**
- Create: `apps/web/src/services/fs.ts`

- [ ] **Step 1: 创建文件系统服务**

```ts
// apps/web/src/services/fs.ts
// 提供 readDir, readFile, writeFile 方法
// 使用 Electron 的 fs API 或通过 API 调用后端
```

---

## 验证检查清单

- [ ] markmap 依赖安装成功
- [ ] 访问 `/video/:id/ai` 显示默认Tab
- [ ] 3个Tab可切换
- [ ] 字幕内容显示正确
- [ ] 笔记内容显示正确
- [ ] 思维导图可交互