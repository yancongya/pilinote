import { Children, type ReactNode, useMemo, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'

import {
  createHeadingIdGenerator,
  extractMarkdownText,
  normalizeMarkdownImageDestinations,
  liftTimestampSection,
  resolveMarkdownImageUrl,
} from './markdownPreviewUtils'

export interface MarkdownPreviewProps {
  content: string
  sourceFolderPath?: string | null
  className?: string
  onSeekToSeconds?: (seconds: number) => void
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

.markdown-preview .markdown-codeblock {
  margin: 1.5rem 0;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.96));
  box-shadow:
    0 24px 60px rgba(2, 6, 23, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.markdown-preview .markdown-codeblock-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(2, 6, 23, 0.25);
}

.markdown-preview .markdown-codeblock-lang {
  font-size: 11px;
  font-weight: 700;
  color: rgba(148, 163, 184, 0.95);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.markdown-preview .markdown-codeblock-copy {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.25);
  color: rgba(248, 250, 252, 0.95);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.markdown-preview .markdown-codeblock-copy:hover {
  background: rgba(148, 163, 184, 0.10);
}

.markdown-preview .markdown-codeblock pre {
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
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
  overflow: auto;
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

.markdown-preview .markdown-seek-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  margin-right: 0.55rem;
  border-radius: 999px;
  border: 1px solid rgba(125, 211, 252, 0.22);
  background: rgba(2, 6, 23, 0.35);
  color: rgba(226, 232, 240, 0.96);
  text-decoration: none;
  font-weight: 750;
  /* Use fixed sizing so it stays consistent inside h2/h3/... */
  font-size: 12px;
  line-height: 16px;
  font-family: inherit;
  letter-spacing: 0;
  white-space: nowrap;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
}

.markdown-preview .markdown-seek-link span[aria-hidden='true'] {
  font-size: 12px;
  line-height: 16px;
}

.markdown-preview .markdown-seek-link:hover {
  background: rgba(56, 189, 248, 0.12);
  border-color: rgba(125, 211, 252, 0.38);
}

.markdown-preview .markdown-seek-link:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.markdown-preview input[type='checkbox'] {
  margin-right: 0.5rem;
  transform: translateY(0.05rem);
  accent-color: rgb(14, 165, 233);
}

.markdown-preview .markdown-timestamp-details {
  margin: 1.25rem 0;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  background: rgba(2, 6, 23, 0.18);
  overflow: hidden;
}

.markdown-preview .markdown-timestamp-details summary {
  cursor: pointer;
  list-style: none;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 750;
  color: rgba(226, 232, 240, 0.96);
  user-select: none;
}

.markdown-preview .markdown-timestamp-details summary::-webkit-details-marker {
  display: none;
}

.markdown-preview .markdown-timestamp-details summary::before {
  content: '▸';
  display: inline-block;
  width: 1em;
  margin-right: 6px;
  color: rgba(148, 163, 184, 0.95);
  transform: translateY(-0.5px);
}

.markdown-preview .markdown-timestamp-details[open] summary::before {
  content: '▾';
}

.markdown-preview .markdown-timestamp-details > ul {
  margin: 0;
  padding: 10px 12px 12px 28px;
}
`

function renderHeading(
  Tag: MarkdownHeadingTag,
  children: ReactNode,
  nextHeadingId: (text: string) => string,
  onSeekToSeconds?: (seconds: number) => void,
) {
  const text = extractMarkdownText(children)
  const id = nextHeadingId(text)
  const trimmed = text.trim()
  const match = trimmed.match(/^((?:\d{1,2}:)?\d{2}:\d{2})\s+(.+)$/)

  const parseTimestampToSeconds = (timestamp: string): number | null => {
    const ts = timestamp.trim()
    const parts = ts.split(':').map(Number)
    if (parts.some(p => !Number.isFinite(p))) return null
    if (parts.length === 2) {
      const [mm, ss] = parts
      return mm * 60 + ss
    }
    if (parts.length === 3) {
      const [hh, mm, ss] = parts
      return hh * 3600 + mm * 60 + ss
    }
    return null
  }

  const timestamp = match ? match[1] : null
  const headingTitle = match ? match[2].trim() : text

  return (
    <Tag
      id={id}
      className={clsx(headingStyles[Tag], 'scroll-mt-24')}
    >
      {timestamp && onSeekToSeconds && (
        <button
          type="button"
          className="markdown-seek-link"
          title="跳转播放进度"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const seconds = parseTimestampToSeconds(timestamp)
            if (seconds === null || seconds < 0) return
            onSeekToSeconds(seconds)
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '0.95em', opacity: 0.9 }}>▶</span>
          <span>{timestamp}</span>
        </button>
      )}
      <span>{headingTitle}</span>
    </Tag>
  )
}

function MarkdownCodeBlock({
  codeText,
  language,
  className,
}: {
  codeText: string
  language?: string | null
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1100)
    } catch {
      // ignore
    }
  }

  return (
    <div className="markdown-codeblock">
      <div className="markdown-codeblock-toolbar">
        {language ? <div className="markdown-codeblock-lang">{language}</div> : <div />}
        <button type="button" className="markdown-codeblock-copy" onClick={handleCopy}>
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre>
        <code className={className}>{codeText}</code>
      </pre>
    </div>
  )
}

export function MarkdownPreview({ content, sourceFolderPath, className, onSeekToSeconds }: MarkdownPreviewProps) {
  const normalizedContent = useMemo(() => {
    return normalizeMarkdownImageDestinations(liftTimestampSection(content))
  }, [content])
  const nextHeadingId = createHeadingIdGenerator()

  const parseTimestampToSeconds = (timestamp: string): number | null => {
    const trimmed = timestamp.trim()
    const match = trimmed.match(/^(\d{1,2}:)?\d{2}:\d{2}$/)
    if (!match) return null
    const parts = trimmed.split(':').map(Number)
    if (parts.some(p => !Number.isFinite(p))) return null
    if (parts.length === 2) {
      const [mm, ss] = parts
      return mm * 60 + ss
    }
    if (parts.length === 3) {
      const [hh, mm, ss] = parts
      return hh * 3600 + mm * 60 + ss
    }
    return null
  }

  const components: Components = {
    h1: ({ children }) => renderHeading('h1', children, nextHeadingId, onSeekToSeconds),
    h2: ({ children }) => renderHeading('h2', children, nextHeadingId, onSeekToSeconds),
    h3: ({ children }) => renderHeading('h3', children, nextHeadingId, onSeekToSeconds),
    h4: ({ children }) => renderHeading('h4', children, nextHeadingId, onSeekToSeconds),
    h5: ({ children }) => renderHeading('h5', children, nextHeadingId, onSeekToSeconds),
    h6: ({ children }) => renderHeading('h6', children, nextHeadingId, onSeekToSeconds),
    p: ({ children }) => <p>{children}</p>,
    blockquote: ({ children }) => (
      <blockquote>
        {children}
      </blockquote>
    ),
    ol: ({ children }) => <ol>{children}</ol>,
    ul: ({ children }) => {
      const items = Children.toArray(children)
      const itemTexts = items.map(item => extractMarkdownText(item).trim()).filter(Boolean)
      const timestampPattern = /^((?:\d{1,2}:)?\d{2}:\d{2})\s+/
      const isTimestampList = itemTexts.length >= 4 && itemTexts.every(text => timestampPattern.test(text))

      if (!isTimestampList) {
        return <ul>{children}</ul>
      }

      return (
        <details className="markdown-timestamp-details">
          <summary>时间戳列表</summary>
          <ul>{children}</ul>
        </details>
      )
    },
    li: ({ children }) => {
      const text = extractMarkdownText(children).trim()
      const match = text.match(/^((?:\d{1,2}:)?\d{2}:\d{2})\s+(.+)$/)
      if (!match || !onSeekToSeconds) {
        return <li>{children}</li>
      }

      const timestamp = match[1]
      const rest = match[2]
      const seconds = parseTimestampToSeconds(timestamp)
      const enabled = seconds !== null && seconds >= 0

      return (
        <li>
          <button
            type="button"
            disabled={!enabled}
            className="markdown-seek-link"
            title="跳转播放进度"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (!enabled || seconds === null) return
              onSeekToSeconds(seconds)
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '0.95em', opacity: 0.9 }}>▶</span>
            <span>{timestamp}</span>
          </button>
          <span>{rest}</span>
        </li>
      )
    },
    a: ({ href = '', children }) => {
      const isInternalAnchor = href.startsWith('#')
      const isSeekAnchor = href.startsWith('#pilinote-seek=')
      const linkText = extractMarkdownText(children)
      const isTimestampText = /^\s*(?:\d{1,2}:)?\d{2}:\d{2}\s*$/.test(linkText)
      const seekValue = isSeekAnchor ? href.slice('#pilinote-seek='.length) : ''
      const seekSeconds = isSeekAnchor ? Number(seekValue) : NaN

      if (isSeekAnchor) {
        const enabled = Number.isFinite(seekSeconds) && seekSeconds >= 0
        return (
          <button
            type="button"
            disabled={!enabled}
            className={isTimestampText ? 'markdown-seek-link' : undefined}
            title={isTimestampText ? '跳转播放进度' : undefined}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (!enabled) return
              onSeekToSeconds?.(seekSeconds)
            }}
            style={{
              // Neutralize default <button> styles while letting the CSS class
              // control the "pill" appearance for timestamps.
              border: isTimestampText ? undefined : 0,
              background: isTimestampText ? undefined : 'transparent',
              padding: isTimestampText ? undefined : 0,
              color: 'inherit',
              cursor: enabled ? 'pointer' : 'not-allowed',
              font: isTimestampText ? undefined : 'inherit',
              textDecoration: isTimestampText ? 'none' : 'underline',
              textUnderlineOffset: isTimestampText ? undefined : '0.18em',
            }}
          >
            {isTimestampText ? (
              <>
                <span aria-hidden="true" style={{ fontSize: '0.95em', opacity: 0.9 }}>▶</span>
                <span>{children}</span>
              </>
            ) : (
              children
            )}
          </button>
        )
      }
      return (
        <a
          href={href}
          className={undefined}
          onClick={(event) => {
            if (!isInternalAnchor) {
              return
            }
            event.preventDefault()
            event.stopPropagation()

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
          // NOTE: `loading=lazy` is unreliable inside nested scroll containers
          // (Chrome/Edge may never load the image if dimensions are unknown).
          // Our markdown screenshots are few and user-triggered, so eager is OK.
          loading="eager"
          src={resolvedSrc}
          style={{ cursor: resolvedSrc ? 'zoom-in' : undefined }}
          onClick={() => {
            if (!resolvedSrc) return
            window.open(resolvedSrc, '_blank', 'noopener,noreferrer')
          }}
        />
      )
    },
    code: ({ className: codeClassName, children }) => {
      const codeText = String(children).replace(/\n$/, '')
      const isBlock = Boolean(codeClassName) || codeText.includes('\n')
      const languageMatch = (codeClassName || '').match(/language-([a-z0-9_+-]+)/i)
      const language = languageMatch?.[1] || null

      if (isBlock) {
        return <MarkdownCodeBlock codeText={codeText} language={language} className={codeClassName} />
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
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}
