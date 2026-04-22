import { type ChangeEvent } from 'react'
import clsx from 'clsx'

import { MarkdownPreview } from './MarkdownPreview'

export type MarkdownEditorMode = 'edit' | 'preview' | 'split'

export interface MarkdownEditorProps {
  content: string
  mode: MarkdownEditorMode
  onChange: (content: string) => void
  onModeChange: (mode: MarkdownEditorMode) => void
  sourceFolderPath?: string | null
  className?: string
  placeholder?: string
}

const MODE_LABELS: Record<MarkdownEditorMode, string> = {
  edit: '编辑',
  preview: '预览',
  split: '分屏',
}

const MODE_ORDER: MarkdownEditorMode[] = ['edit', 'preview', 'split']

function ModeButton({
  mode,
  active,
  onClick,
}: {
  mode: MarkdownEditorMode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={clsx(
        'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-sky-500/20 text-sky-100 ring-1 ring-inset ring-sky-400/35 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
      )}
      onClick={onClick}
    >
      {MODE_LABELS[mode]}
    </button>
  )
}

export function MarkdownEditor({
  content,
  mode,
  onChange,
  onModeChange,
  sourceFolderPath,
  className,
  placeholder = '开始编辑 Markdown 内容...',
}: MarkdownEditorProps) {
  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value)
  }

  return (
    <div className={clsx('flex min-h-0 flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.68))] px-3 py-2.5 shadow-[0_18px_40px_rgba(2,6,23,0.18)] backdrop-blur-sm">
        {MODE_ORDER.map((item) => (
          <ModeButton
            key={item}
            mode={item}
            active={item === mode}
            onClick={() => onModeChange(item)}
          />
        ))}
      </div>

      {mode === 'edit' ? (
        <textarea
          className="min-h-[360px] w-full flex-1 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(15,23,42,0.84))] px-5 py-4 text-[15px] leading-8 text-slate-100 shadow-[0_20px_50px_rgba(2,6,23,0.24)] outline-none transition-all placeholder:text-slate-500 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
          placeholder={placeholder}
          spellCheck={false}
          value={content}
          onChange={handleInputChange}
        />
      ) : mode === 'preview' ? (
        <div className="min-h-[360px] rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.76),rgba(15,23,42,0.58))] px-4 py-5 shadow-[0_20px_50px_rgba(2,6,23,0.18)]">
          <MarkdownPreview content={content} sourceFolderPath={sourceFolderPath} />
        </div>
      ) : (
        <div className="grid min-h-[360px] gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <textarea
            className="min-h-[360px] w-full rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(15,23,42,0.84))] px-5 py-4 text-[15px] leading-8 text-slate-100 shadow-[0_20px_50px_rgba(2,6,23,0.24)] outline-none transition-all placeholder:text-slate-500 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
            placeholder={placeholder}
            spellCheck={false}
            value={content}
            onChange={handleInputChange}
          />
          <div className="min-h-[360px] rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.76),rgba(15,23,42,0.58))] px-4 py-5 shadow-[0_20px_50px_rgba(2,6,23,0.18)]">
            <MarkdownPreview content={content} sourceFolderPath={sourceFolderPath} />
          </div>
        </div>
      )}
    </div>
  )
}
