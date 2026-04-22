import { useMemo } from 'react'

import '@mdxeditor/editor/style.css'
import {
  MDXEditor,
  codeBlockPlugin,
  headingsPlugin,
  imagePlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  diffSourcePlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
} from '@mdxeditor/editor'
import type { RealmPlugin } from '@mdxeditor/editor'
import clsx from 'clsx'

import { resolveMarkdownImageUrl } from './markdownPreviewUtils'

export type MdxNoteEditorMode = 'edit' | 'preview' | 'split'

export interface MdxNoteEditorProps {
  content: string
  mode: MdxNoteEditorMode
  onChange: (content: string) => void
  sourceFolderPath?: string | null
  documentKey?: string
  className?: string
}

interface MdxEditorPaneProps {
  content: string
  onChange?: (content: string) => void
  sourceFolderPath?: string | null
  className?: string
  ariaLabel: string
  documentKey?: string
  readOnly?: boolean
}

const editorStyle = `
.ai-mdx-note-editor {
  min-height: 100%;
  --mdx-surface-bg: rgba(255, 255, 255, 0.98);
  --mdx-surface-bg-2: rgba(248, 250, 252, 0.98);
  --mdx-surface-border: rgba(148, 163, 184, 0.18);
  --mdx-text: #0f172a;
  --mdx-text-secondary: #334155;
  --mdx-link: #0284c7;
  --mdx-code-bg: rgba(241, 245, 249, 0.98);
  --mdx-code-border: rgba(148, 163, 184, 0.28);
  --mdx-quote-bg: rgba(248, 250, 252, 1);
  --mdx-quote-bg-2: rgba(241, 245, 249, 1);
  --mdx-table-head-bg: rgba(248, 250, 252, 1);
  --mdx-table-border: rgba(148, 163, 184, 0.2);
  --mdx-image-border: rgba(148, 163, 184, 0.2);
  --mdx-shadow: rgba(15, 23, 42, 0.08);
  color: var(--mdx-text);
  background: transparent;
}

.dark .ai-mdx-note-editor {
  --mdx-surface-bg: rgba(9, 12, 20, 0.98);
  --mdx-surface-bg-2: rgba(17, 24, 39, 0.98);
  --mdx-surface-border: rgba(71, 85, 105, 0.6);
  --mdx-text: #e2e8f0;
  --mdx-text-secondary: #cbd5e1;
  --mdx-link: #7dd3fc;
  --mdx-code-bg: rgba(15, 23, 42, 0.98);
  --mdx-code-border: rgba(71, 85, 105, 0.65);
  --mdx-quote-bg: rgba(15, 23, 42, 0.98);
  --mdx-quote-bg-2: rgba(30, 41, 59, 0.96);
  --mdx-table-head-bg: rgba(15, 23, 42, 1);
  --mdx-table-border: rgba(71, 85, 105, 0.42);
  --mdx-image-border: rgba(71, 85, 105, 0.55);
  --mdx-shadow: rgba(0, 0, 0, 0.42);
}

.ai-mdx-note-editor .ai-mdx-note-editor__pane {
  min-height: 0;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content {
  min-height: 30rem;
  max-width: 52rem;
  margin: 0 auto;
  padding: 0.6rem 0.2rem 2.6rem;
  color: var(--mdx-text);
  font-size: 15.5px;
  line-height: 1.88;
  letter-spacing: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content :is(h1, h2, h3, h4, h5, h6) {
  scroll-margin-top: 1.5rem;
  color: var(--mdx-text) !important;
  font-weight: 700;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content h1 {
  margin: 0.25rem 0 1rem;
  font-size: 1.95rem;
  line-height: 1.2;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content h2 {
  margin: 1.8rem 0 0.8rem;
  font-size: 1.35rem;
  line-height: 1.25;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content h3 {
  margin: 1.35rem 0 0.7rem;
  font-size: 1.15rem;
  line-height: 1.35;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content p {
  margin: 0 0 0.95rem;
  color: var(--mdx-text);
}

.ai-mdx-note-editor .ai-mdx-note-editor__content strong {
  color: var(--mdx-text) !important;
  font-weight: 650;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content a {
  color: var(--mdx-link) !important;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content blockquote {
  margin: 1.3rem 0;
  border-left: 4px solid rgba(56, 189, 248, 0.75);
  border-radius: 0 16px 16px 0;
  background: linear-gradient(135deg, var(--mdx-quote-bg), var(--mdx-quote-bg-2));
  padding: 0.95rem 1.05rem;
  color: var(--mdx-text-secondary) !important;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content ul,
.ai-mdx-note-editor .ai-mdx-note-editor__content ol {
  margin: 0 0 0.95rem;
  padding-left: 1.5rem;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content li {
  margin: 0.3rem 0;
  color: var(--mdx-text);
}

.ai-mdx-note-editor .ai-mdx-note-editor__content code:not(pre code) {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 9999px;
  background: rgba(148, 163, 184, 0.1);
  padding: 0.1rem 0.42rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.9em;
  color: var(--mdx-text) !important;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content code > span {
  background: transparent !important;
  color: inherit !important;
  padding: 0 !important;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content pre {
  margin: 1.25rem 0;
  overflow-x: auto;
  border: 1px solid var(--mdx-code-border);
  border-radius: 18px;
  background: linear-gradient(180deg, var(--mdx-code-bg), var(--mdx-code-bg));
}

.ai-mdx-note-editor .mdxeditor-source-editor {
  min-height: 100%;
  color: var(--mdx-text);
}

.ai-mdx-note-editor .mdxeditor-source-editor .cm-editor {
  height: 100%;
  min-height: 30rem;
  background: transparent !important;
  color: var(--mdx-text) !important;
}

.ai-mdx-note-editor .mdxeditor-source-editor .cm-scroller,
.ai-mdx-note-editor .mdxeditor-source-editor .cm-gutters,
.ai-mdx-note-editor .mdxeditor-source-editor .cm-content {
  background: transparent !important;
  color: var(--mdx-text) !important;
}

.ai-mdx-note-editor .mdxeditor-source-editor .cm-content {
  caret-color: var(--mdx-text) !important;
}

.ai-mdx-note-editor .mdxeditor-source-editor .cm-gutters {
  border-right: 1px solid var(--mdx-surface-border) !important;
  color: var(--mdx-text-secondary) !important;
}

.ai-mdx-note-editor .mdxeditor-source-editor .cm-lineNumbers .cm-gutterElement {
  color: var(--mdx-text-secondary) !important;
}

.ai-mdx-note-editor .mdxeditor-source-editor .cm-activeLine,
.ai-mdx-note-editor .mdxeditor-source-editor .cm-activeLineGutter {
  background: rgba(59, 130, 246, 0.08) !important;
}

.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-editor,
.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-scroller,
.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-gutters,
.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-content {
  background: rgba(8, 12, 20, 0.96) !important;
}

.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-editor {
  color: var(--mdx-text) !important;
}

.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-gutters {
  border-right-color: rgba(71, 85, 105, 0.55) !important;
}

.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-lineNumbers .cm-gutterElement,
.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-foldPlaceholder,
.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-matchingBracket {
  color: var(--mdx-text-secondary) !important;
}

.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-cursor,
.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-dropCursor {
  border-left-color: var(--mdx-text) !important;
}

.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-selectionBackground,
.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-content ::selection {
  background: rgba(56, 189, 248, 0.22) !important;
}

.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-activeLine,
.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-activeLineGutter {
  background: rgba(56, 189, 248, 0.1) !important;
}

.dark .ai-mdx-note-editor .mdxeditor-source-editor .cm-tooltip {
  border-color: rgba(71, 85, 105, 0.75) !important;
  background: rgba(15, 23, 42, 0.98) !important;
  color: var(--mdx-text) !important;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content pre code {
  display: block;
  padding: 1rem 1.1rem;
  border: 0;
  background: transparent;
  color: var(--mdx-text) !important;
  font-size: 0.92rem;
  line-height: 1.75;
  white-space: pre;
}

.dark .ai-mdx-note-editor .ai-mdx-note-editor__content pre,
.dark .ai-mdx-note-editor .ai-mdx-note-editor__content code:not(pre code) {
  background: rgba(15, 23, 42, 0.98);
}

.dark .ai-mdx-note-editor .ai-mdx-note-editor__content code:not(pre code) {
  border-color: rgba(71, 85, 105, 0.42);
  background: rgba(71, 85, 105, 0.18);
  color: #e2e8f0 !important;
}

.dark .ai-mdx-note-editor .ai-mdx-note-editor__content pre code {
  color: #e2e8f0 !important;
}

.dark .ai-mdx-note-editor .ai-mdx-note-editor__content code > span {
  background: transparent !important;
  color: inherit !important;
}

.ai-mdx-note-editor .mdxeditor .cm-editor,
.ai-mdx-note-editor .mdxeditor .cm-scroller,
.ai-mdx-note-editor .mdxeditor .cm-content,
.ai-mdx-note-editor .mdxeditor .cm-gutters,
.ai-mdx-note-editor .mdxeditor .sp-editor .cm-editor {
  background: transparent !important;
  color: var(--mdx-text) !important;
}

.ai-mdx-note-editor .mdxeditor .cm-sourceView .cm-scroller,
.ai-mdx-note-editor .mdxeditor .sp-cm pre {
  background: transparent !important;
  color: var(--mdx-text) !important;
}

.dark .ai-mdx-note-editor .mdxeditor .cm-editor,
.dark .ai-mdx-note-editor .mdxeditor .cm-scroller,
.dark .ai-mdx-note-editor .mdxeditor .cm-content,
.dark .ai-mdx-note-editor .mdxeditor .cm-gutters,
.dark .ai-mdx-note-editor .mdxeditor .sp-editor .cm-editor,
.dark .ai-mdx-note-editor .mdxeditor .cm-sourceView .cm-scroller,
.dark .ai-mdx-note-editor .mdxeditor .sp-cm pre {
  background: rgba(8, 12, 20, 0.96) !important;
  color: var(--mdx-text) !important;
}

.dark .ai-mdx-note-editor .mdxeditor .sp-cm pre,
.dark .ai-mdx-note-editor .mdxeditor .cm-sourceView .cm-scroller {
  color: #e2e8f0 !important;
}

.dark .ai-mdx-note-editor .mdxeditor .cm-gutters {
  border-right: 1px solid rgba(71, 85, 105, 0.55) !important;
}

.ai-mdx-note-editor .mdxeditor .tok-code,
.ai-mdx-note-editor .mdxeditor .cm-inlineCode,
.ai-mdx-note-editor .mdxeditor .cm-code {
  border-radius: 9999px;
  background: rgba(148, 163, 184, 0.1);
  padding: 0.02rem 0.3rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  color: var(--mdx-text) !important;
}

.dark .ai-mdx-note-editor .mdxeditor .tok-code,
.dark .ai-mdx-note-editor .mdxeditor .cm-inlineCode,
.dark .ai-mdx-note-editor .mdxeditor .cm-code {
  background: rgba(71, 85, 105, 0.18);
  color: #e2e8f0 !important;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.25rem 0;
  overflow: hidden;
  border-radius: 16px;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content thead th {
  background: var(--mdx-table-head-bg);
  color: var(--mdx-text) !important;
  font-weight: 600;
}

.ai-mdx-note-editor .ai-mdx-note-editor__content th,
.ai-mdx-note-editor .ai-mdx-note-editor__content td {
  border-bottom: 1px solid var(--mdx-table-border);
  padding: 0.85rem 0.95rem;
  text-align: left;
  vertical-align: top;
  color: var(--mdx-text);
}

.ai-mdx-note-editor .ai-mdx-note-editor__content img {
  display: block;
  max-width: 100%;
  margin: 1.25rem auto;
  border-radius: 18px;
  border: 1px solid var(--mdx-image-border);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
}

.ai-mdx-note-editor .ai-mdx-note-editor__content input[type='checkbox'] {
  margin-right: 0.45rem;
  transform: translateY(0.05rem);
  accent-color: rgb(14, 165, 233);
}

.ai-mdx-note-editor .ai-mdx-note-editor__content hr {
  margin: 1.5rem 0;
  border: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.24);
}
`

function normalizeMarkdownForMdxEditor(markdown: string): string {
  return markdown.replace(/<br\s*>/gi, '<br />')
}

function buildPlugins(sourceFolderPath?: string | null, editable = false): RealmPlugin[] {
  const plugins: RealmPlugin[] = [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    linkPlugin(),
    imagePlugin({
      imagePreviewHandler: async (imageSource) => resolveMarkdownImageUrl(imageSource, sourceFolderPath),
    }),
    tablePlugin(),
    codeBlockPlugin(),
  ]

  if (editable) {
    plugins.unshift(
      diffSourcePlugin({
        viewMode: 'source',
      }),
    )
  }

  return plugins
}

function MdxEditorPane({
  content,
  onChange,
  sourceFolderPath,
  className,
  ariaLabel,
  documentKey,
  readOnly = false,
}: MdxEditorPaneProps) {
  const plugins = useMemo(() => buildPlugins(sourceFolderPath, !readOnly), [sourceFolderPath, readOnly])
  const normalizedContent = useMemo(() => normalizeMarkdownForMdxEditor(content), [content])

  return (
    <div className={clsx('ai-mdx-note-editor h-full min-h-0', className)}>
      <MDXEditor
        key={`${documentKey || 'note'}:${readOnly ? 'preview' : 'edit'}`}
        aria-label={ariaLabel}
        className="h-full min-h-0"
        contentEditableClassName="ai-mdx-note-editor__content"
        markdown={normalizedContent}
        onChange={(markdown, initialMarkdownNormalize) => {
          if (!initialMarkdownNormalize) {
            onChange?.(markdown)
          }
        }}
        plugins={plugins}
        readOnly={readOnly}
        spellCheck={false}
        trim={false}
      />
    </div>
  )
}

export function MdxNoteEditor({
  content,
  mode,
  onChange,
  sourceFolderPath,
  documentKey,
  className,
}: MdxNoteEditorProps) {
  return (
    <section className={clsx('flex h-full min-h-0 flex-col gap-3', className)}>
      <style>{editorStyle}</style>

      {mode === 'split' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <MdxEditorPane
            ariaLabel="MDX 编辑器"
            className="h-full min-h-0 overflow-auto"
            content={content}
            documentKey={`${documentKey || 'note'}:edit`}
            onChange={onChange}
            sourceFolderPath={sourceFolderPath}
          />
          <MdxEditorPane
            ariaLabel="MDX 预览"
            className="h-full min-h-0 overflow-auto"
            content={content}
            documentKey={`${documentKey || 'note'}:preview`}
            readOnly
            sourceFolderPath={sourceFolderPath}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <MdxEditorPane
            ariaLabel={mode === 'preview' ? 'MDX 预览' : 'MDX 编辑器'}
            className="h-full min-h-0"
            content={content}
            documentKey={documentKey}
            onChange={mode === 'edit' ? onChange : undefined}
            readOnly={mode === 'preview'}
            sourceFolderPath={sourceFolderPath}
          />
        </div>
      )}
    </section>
  )
}
