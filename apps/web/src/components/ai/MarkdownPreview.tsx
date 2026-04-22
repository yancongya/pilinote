import { type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'

import {
  createHeadingIdGenerator,
  extractMarkdownText,
  resolveMarkdownImageUrl,
} from './markdownPreviewUtils'

export interface MarkdownPreviewProps {
  content: string
  sourceFolderPath?: string | null
  className?: string
}

type MarkdownHeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

const headingStyles: Record<MarkdownHeadingTag, string> = {
  h1: 'mt-8 mb-4 text-[2rem] font-semibold tracking-[-0.02em] text-white',
  h2: 'mt-8 mb-3 text-[1.5rem] font-semibold tracking-[-0.015em] text-slate-50',
  h3: 'mt-6 mb-3 text-[1.25rem] font-semibold tracking-[-0.01em] text-slate-100',
  h4: 'mt-5 mb-2 text-[1.05rem] font-semibold text-slate-100',
  h5: 'mt-4 mb-2 text-base font-semibold text-slate-100',
  h6: 'mt-4 mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-400',
}

const markdownPreviewStyles = `
.markdown-preview {
  color: rgba(226, 232, 240, 0.96);
  font-size: 15px;
  line-height: 1.85;
  letter-spacing: 0.005em;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.markdown-preview > :first-child {
  margin-top: 0 !important;
}

.markdown-preview > :last-child {
  margin-bottom: 0 !important;
}

.markdown-preview p {
  margin: 0 0 1rem;
}

.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3,
.markdown-preview h4,
.markdown-preview h5,
.markdown-preview h6 {
  scroll-margin-top: 1.5rem;
}

.markdown-preview strong {
  color: rgba(248, 250, 252, 0.98);
  font-weight: 650;
}

.markdown-preview em {
  color: rgba(203, 213, 225, 0.95);
}

.markdown-preview hr {
  margin: 1.75rem 0;
  border: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.markdown-preview ul,
.markdown-preview ol {
  margin: 0 0 1rem;
  padding-left: 1.5rem;
}

.markdown-preview ul {
  list-style: disc;
}

.markdown-preview ol {
  list-style: decimal;
}

.markdown-preview li {
  margin: 0.35rem 0;
}

.markdown-preview li > p {
  margin: 0.25rem 0;
}

.markdown-preview blockquote {
  margin: 1.5rem 0;
  border-left: 4px solid rgba(56, 189, 248, 0.6);
  border-radius: 0 16px 16px 0;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.55));
  padding: 1rem 1.1rem;
  color: rgba(226, 232, 240, 0.92);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.markdown-preview blockquote p {
  margin: 0;
}

.markdown-preview code:not(pre code) {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.78);
  padding: 0.12rem 0.45rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.9em;
  color: rgba(248, 250, 252, 0.98);
}

.markdown-preview pre {
  margin: 1.5rem 0;
  overflow-x: auto;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.96));
  box-shadow:
    0 24px 60px rgba(2, 6, 23, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.markdown-preview pre code {
  display: block;
  padding: 1rem 1.1rem;
  border: 0;
  background: transparent;
  border-radius: 0;
  color: rgba(226, 232, 240, 0.98);
  font-size: 0.92rem;
  line-height: 1.75;
  white-space: pre;
}

.markdown-preview table {
  width: 100%;
  border-collapse: collapse;
}

.markdown-preview .markdown-table {
  margin: 1.5rem 0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.markdown-preview .markdown-table table {
  min-width: 100%;
}

.markdown-preview thead th {
  background: rgba(30, 41, 59, 0.9);
  color: rgba(248, 250, 252, 0.98);
  font-weight: 600;
}

.markdown-preview th,
.markdown-preview td {
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  padding: 0.85rem 0.95rem;
  text-align: left;
  vertical-align: top;
}

.markdown-preview tbody tr:last-child td {
  border-bottom: 0;
}

.markdown-preview img {
  display: block;
  max-width: 100%;
  margin: 1.5rem auto;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 40px rgba(2, 6, 23, 0.35);
}

.markdown-preview a {
  color: rgba(125, 211, 252, 0.98);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

.markdown-preview a:hover {
  color: rgba(186, 230, 253, 1);
}

.markdown-preview input[type='checkbox'] {
  margin-right: 0.5rem;
  transform: translateY(0.05rem);
  accent-color: rgb(14, 165, 233);
}
`

function renderHeading(
  Tag: MarkdownHeadingTag,
  children: ReactNode,
  nextHeadingId: (text: string) => string,
) {
  const text = extractMarkdownText(children)
  const id = nextHeadingId(text)

  return (
    <Tag
      id={id}
      className={clsx(headingStyles[Tag], 'scroll-mt-24 cursor-pointer')}
      onClick={() => {
        const target = document.getElementById(id)
        target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      }}
    >
      {children}
    </Tag>
  )
}

export function MarkdownPreview({ content, sourceFolderPath, className }: MarkdownPreviewProps) {
  const nextHeadingId = createHeadingIdGenerator()

  const components: Components = {
    h1: ({ children }) => renderHeading('h1', children, nextHeadingId),
    h2: ({ children }) => renderHeading('h2', children, nextHeadingId),
    h3: ({ children }) => renderHeading('h3', children, nextHeadingId),
    h4: ({ children }) => renderHeading('h4', children, nextHeadingId),
    h5: ({ children }) => renderHeading('h5', children, nextHeadingId),
    h6: ({ children }) => renderHeading('h6', children, nextHeadingId),
    p: ({ children }) => <p>{children}</p>,
    blockquote: ({ children }) => (
      <blockquote>
        {children}
      </blockquote>
    ),
    ul: ({ children }) => <ul>{children}</ul>,
    ol: ({ children }) => <ol>{children}</ol>,
    li: ({ children }) => <li>{children}</li>,
    a: ({ href = '', children }) => {
      const isInternalAnchor = href.startsWith('#')
      return (
        <a
          href={href}
          className=""
          onClick={(event) => {
            if (!isInternalAnchor) {
              return
            }
            event.preventDefault()
            const targetId = href.slice(1)
            const target = document.getElementById(targetId)
            target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
          }}
          rel={isInternalAnchor ? undefined : 'noreferrer noopener'}
          target={isInternalAnchor ? undefined : '_blank'}
        >
          {children}
        </a>
      )
    },
    img: ({ src = '', alt = '' }) => {
      const resolvedSrc = resolveMarkdownImageUrl(src, sourceFolderPath)
      return (
        <img
          alt={alt}
          loading="lazy"
          src={resolvedSrc}
        />
      )
    },
    code: ({ className: codeClassName, children }) => {
      const codeText = String(children).replace(/\n$/, '')
      const isBlock = Boolean(codeClassName) || codeText.includes('\n')

      if (isBlock) {
        return (
          <pre>
            <code className={codeClassName}>{codeText}</code>
          </pre>
        )
      }

      return (
        <code>{children}</code>
      )
    },
    table: ({ children }) => (
      <div className="markdown-table">
        <table>{children}</table>
      </div>
    ),
    input: ({ type, checked, disabled }) => {
      if (type !== 'checkbox') {
        return <input type={type} disabled={disabled} />
      }

      return <input type="checkbox" checked={checked} disabled={disabled} />
    },
  }

  return (
    <div className={clsx('markdown-preview mx-auto w-full max-w-[920px] px-1 sm:px-2 md:px-4', className)}>
      <style>{markdownPreviewStyles}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
