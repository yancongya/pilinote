import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import JSZip from 'jszip'
import clsx from 'clsx'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'
import { Toolbar } from 'markmap-toolbar'
import 'markmap-toolbar/dist/style.css'

import { useToast } from '../../../components/Toast'
import {
  buildMindMapData,
  cloneMindMapTree,
  formatMindMapExportName,
  getNextMindMapCycleState,
  type MindMapCycleDirection,
} from '../../../components/ai/mindmapUtils'

const transformer = new Transformer()
const TOOLBAR_POSITION_KEY = 'pilinote:mindmap-toolbar-position'
const TOOLBAR_TOOLTIP_LABELS = ['放大', '缩小', '适配视图', '逐级展开/折叠', '导出 SVG', '导出 PNG', '导出 HTML', '导出 XMind']

interface MindMapTabProps {
  content: string
  title?: string
}

type ThemeMode = 'light' | 'dark'

interface ToolbarPosition {
  x: number
  y: number
}

interface ToolbarTooltipState {
  text: string
  x: number
  y: number
}

function getThemeMode(): ThemeMode {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function createToolbarIcon(path: string, label: string) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '20')
  svg.setAttribute('height', '20')
  svg.setAttribute('viewBox', '0 0 20 20')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
  title.textContent = label
  svg.appendChild(title)

  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  iconPath.setAttribute('d', path)
  iconPath.setAttribute('fill', 'none')
  iconPath.setAttribute('stroke', 'currentColor')
  iconPath.setAttribute('stroke-width', '1.6')
  iconPath.setAttribute('stroke-linecap', 'round')
  iconPath.setAttribute('stroke-linejoin', 'round')
  svg.appendChild(iconPath)
  return svg
}

function attachToolbarTooltips(toolbarRoot: HTMLElement) {
  const items = toolbarRoot.querySelectorAll<HTMLElement>('.mm-toolbar-item, .mm-toolbar-brand')
  items.forEach((item, index) => {
    const label = TOOLBAR_TOOLTIP_LABELS[index] || item.getAttribute('title') || item.textContent?.trim()
    if (!label) return
    item.setAttribute('title', label)
    item.setAttribute('aria-label', label)
    item.setAttribute('data-tooltip', label)
  })
}

function loadToolbarPosition(): ToolbarPosition | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TOOLBAR_POSITION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ToolbarPosition>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    return { x: parsed.x, y: parsed.y }
  } catch (error) {
    console.warn('读取导图工具栏位置失败:', error)
    return null
  }
}

function saveToolbarPosition(position: ToolbarPosition) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TOOLBAR_POSITION_KEY, JSON.stringify(position))
  } catch (error) {
    console.warn('保存导图工具栏位置失败:', error)
  }
}

function clampToolbarPosition(
  position: ToolbarPosition,
  containerWidth: number,
  containerHeight: number,
  toolbarWidth: number,
  toolbarHeight: number,
): ToolbarPosition {
  const padding = 12
  const maxX = Math.max(padding, containerWidth - toolbarWidth - padding)
  const maxY = Math.max(padding, containerHeight - toolbarHeight - padding)
  return {
    x: Math.min(Math.max(position.x, padding), maxX),
    y: Math.min(Math.max(position.y, padding), maxY),
  }
}

function getTreeDepth(node: any): number {
  if (!node?.children?.length) return 1
  return 1 + Math.max(...node.children.map((child: any) => getTreeDepth(child)))
}

async function buildXMindXml(markdown: string, title: string): Promise<Blob> {
  const { root } = transformer.transform(markdown)
  const generateId = () => Math.random().toString(36).substring(2, 15)

  const decodeHtmlEntities = (text: string): string => {
    if (!text) return text
    let decoded = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    decoded = decoded.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    const textarea = document.createElement('textarea')
    textarea.innerHTML = decoded
    return textarea.value
  }

  const stripHtml = (html: string): string => {
    if (!html) return html
    const div = document.createElement('div')
    div.innerHTML = decodeHtmlEntities(html)
    return div.textContent || div.innerText || html
  }

  const convertToXMindNode = (node: any): any => {
    const rawTitle = node.content || node.payload?.content || '未命名'
    const topic: any = {
      id: generateId(),
      class: 'topic',
      title: stripHtml(rawTitle),
    }

    if (node.children && node.children.length > 0) {
      topic.children = {
        attached: node.children.map((child: any) => convertToXMindNode(child)),
      }
    }

    return topic
  }

  const sheetId = generateId()
  const rootTopic = convertToXMindNode(root)
  const contentJson = [{
    id: sheetId,
    class: 'sheet',
    title: stripHtml(title) || '思维导图',
    rootTopic,
    topicPositioning: 'fixed',
  }]

  const metadata = {
    creator: { name: 'PiliNote', version: '1.0.0' },
  }

  const manifest = {
    'file-entries': {
      'content.json': {},
      'metadata.json': {},
    },
  }

  const zip = new JSZip()
  zip.file('content.json', JSON.stringify(contentJson, null, 2))
  zip.file('metadata.json', JSON.stringify(metadata, null, 2))
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  return zip.generateAsync({ type: 'blob' })
}

export function MindMapTab({ content, title }: MindMapTabProps) {
  const { showToast } = useToast()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const toolbarShellRef = useRef<HTMLDivElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const mmRef = useRef<any>(null)
  const mindMapTreeRef = useRef<any>(null)
  const mindMapCycleStateRef = useRef<{
    depth: number
    maxDepth: number
    direction: MindMapCycleDirection
  } | null>(null)
  const cycleHoldTimerRef = useRef<number | null>(null)
  const cycleRepeatTimerRef = useRef<number | null>(null)
  const suppressNextClickRef = useRef(false)
  const dragStateRef = useRef<{
    pointerId: number
    offsetX: number
    offsetY: number
    toolbarWidth: number
    toolbarHeight: number
  } | null>(null)
  const toolbarPositionRef = useRef<ToolbarPosition | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getThemeMode())
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition | null>(loadToolbarPosition)
  const [toolbarTooltip, setToolbarTooltip] = useState<ToolbarTooltipState | null>(null)
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false)

  const mindMapSource = useMemo(() => buildMindMapData(content), [content])
  const hasContent = mindMapSource.trim().length > 0
  const mindMapTree = useMemo(() => {
    if (!hasContent) return null
    return transformer.transform(mindMapSource).root
  }, [hasContent, mindMapSource])
  const exportTitle = useMemo(() => formatMindMapExportName(title), [title])
  const mindMapMaxDepth = useMemo(() => (mindMapTree ? getTreeDepth(mindMapTree) : 1), [mindMapTree])
  const themeStyle = useMemo(() => {
    if (themeMode === 'dark') {
      return {
        '--markmap-a-color': '#7dd3fc',
        '--markmap-a-hover-color': '#38bdf8',
        '--markmap-code-bg': '#1f2937',
        '--markmap-code-color': '#e5e7eb',
        '--markmap-circle-open-bg': '#374151',
        '--markmap-highlight-bg': '#2b3444',
        '--markmap-highlight-node-bg': 'rgba(96, 165, 250, 0.18)',
        '--markmap-table-border': '1px solid rgba(148, 163, 184, 0.35)',
        '--markmap-text-color': '#e5e7eb',
      } as CSSProperties
    }

    return {
      '--markmap-a-color': '#0284c7',
      '--markmap-a-hover-color': '#0ea5e9',
      '--markmap-code-bg': '#f1f5f9',
      '--markmap-code-color': '#334155',
      '--markmap-circle-open-bg': '#ffffff',
      '--markmap-highlight-bg': '#fef3c7',
      '--markmap-highlight-node-bg': 'rgba(59, 130, 246, 0.12)',
      '--markmap-table-border': '1px solid rgba(148, 163, 184, 0.45)',
      '--markmap-text-color': '#1f2937',
    } as CSSProperties
  }, [themeMode])

  const exportSvg = useCallback(async () => {
    try {
      if (!svgRef.current || !mmRef.current || !hasContent) return
      await mmRef.current.fit()
      await new Promise(resolve => setTimeout(resolve, 100))

      const svgEl = svgRef.current
      const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement
      const gElement = svgEl.querySelector('g')

      if (gElement) {
        const bbox = gElement.getBBox()
        const padding = 50
        const viewBoxX = bbox.x - padding
        const viewBoxY = bbox.y - padding
        const viewBoxWidth = bbox.width + padding * 2
        const viewBoxHeight = bbox.height + padding * 2
        clonedSvg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`)
        clonedSvg.removeAttribute('width')
        clonedSvg.removeAttribute('height')
        clonedSvg.setAttribute('width', '100%')
        clonedSvg.setAttribute('height', '100%')
        clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      }

      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.textContent = 'svg { background-color: white; }'
      clonedSvg.insertBefore(style, clonedSvg.firstChild)
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

      const viewBox = clonedSvg.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 800, 600]
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bgRect.setAttribute('x', viewBox[0].toString())
      bgRect.setAttribute('y', viewBox[1].toString())
      bgRect.setAttribute('width', viewBox[2].toString())
      bgRect.setAttribute('height', viewBox[3].toString())
      bgRect.setAttribute('fill', 'white')
      const firstG = clonedSvg.querySelector('g')
      if (firstG) {
        clonedSvg.insertBefore(bgRect, firstG)
      } else {
        clonedSvg.insertBefore(bgRect, clonedSvg.firstChild)
      }

      const svgData = new XMLSerializer().serializeToString(clonedSvg)
      downloadBlob(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }), `${exportTitle}.svg`)
      showToast('已导出 SVG', 'success')
    } catch (error) {
      console.error('导出SVG失败:', error)
      showToast('导出 SVG 失败', 'error')
    }
  }, [exportTitle, hasContent, showToast])

  const exportPng = useCallback(async () => {
    try {
      if (!svgRef.current || !mmRef.current || !hasContent) return
      const svgEl = svgRef.current
      await mmRef.current.fit()
      await new Promise(resolve => setTimeout(resolve, 100))

      const svgWidth = svgEl.width.baseVal.value || svgEl.clientWidth || 800
      const svgHeight = svgEl.height.baseVal.value || svgEl.clientHeight || 600
      const scale = 3
      const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement

      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.textContent = 'svg { background-color: white; }'
      clonedSvg.insertBefore(style, clonedSvg.firstChild)
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clonedSvg.setAttribute('width', svgWidth.toString())
      clonedSvg.setAttribute('height', svgHeight.toString())

      const svgData = new XMLSerializer().serializeToString(clonedSvg)
      const svgBase64 = btoa(unescape(encodeURIComponent(svgData)))
      const dataUri = `data:image/svg+xml;base64,${svgBase64}`

      const canvas = document.createElement('canvas')
      canvas.width = svgWidth * scale
      canvas.height = svgHeight * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法获取Canvas上下文')
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const img = new Image()
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          canvas.toBlob((blob) => {
            if (blob) {
              downloadBlob(blob, `${exportTitle}.png`)
              showToast('已导出 PNG', 'success')
            } else {
              showToast('导出 PNG 失败', 'error')
            }
          }, 'image/png')
        } catch (error) {
          console.error('Canvas处理失败:', error)
          showToast('导出 PNG 失败', 'error')
        }
      }
      img.onerror = () => {
        showToast('导出 PNG 失败', 'error')
      }
      img.src = dataUri
    } catch (error) {
      console.error('导出PNG失败:', error)
      showToast('导出 PNG 失败', 'error')
    }
  }, [exportTitle, hasContent, showToast])

  const exportHtml = useCallback(() => {
    try {
      if (!hasContent) return
      const { root } = transformer.transform(mindMapSource)
      const data = JSON.stringify(root)
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${exportTitle}</title>
  <style>
    body { margin: 0; padding: 0; font-family: sans-serif; }
    #mindmap { display: block; width: 100%; height: 100vh; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.18.10"></script>
</head>
<body>
  <svg id="mindmap"></svg>
  <script>
  (async () => {
    const { markmap } = window;
    const { Markmap } = markmap;
    const mm = Markmap.create(document.getElementById('mindmap'));
    mm.setData(${data});
    mm.fit();
  })();
  </script>
</body>
</html>`
      downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${exportTitle}.html`)
      showToast('已导出 HTML', 'success')
    } catch (error) {
      console.error('导出HTML失败:', error)
      showToast('导出 HTML 失败', 'error')
    }
  }, [exportTitle, hasContent, mindMapSource, showToast])

  const exportXMind = useCallback(async () => {
    try {
      if (!hasContent) return
      const blob = await buildXMindXml(mindMapSource, exportTitle)
      downloadBlob(blob, `${exportTitle}.xmind`)
      showToast('已导出 XMind', 'success')
    } catch (error) {
      console.error('导出XMind失败:', error)
      showToast('导出 XMind 失败', 'error')
    }
  }, [exportTitle, hasContent, mindMapSource, showToast])

  const getInitialCycleState = useCallback(() => {
    const maxDepth = Math.max(1, mindMapMaxDepth)
    return {
      depth: maxDepth > 1 ? Math.min(2, maxDepth) : 1,
      maxDepth,
      direction: 'expand' as MindMapCycleDirection,
    }
  }, [mindMapMaxDepth])

  const applyMindMapCycleState = useCallback(
    async (nextState: { depth: number; maxDepth: number; direction: MindMapCycleDirection }) => {
      const mm = mmRef.current
      const tree = mindMapTreeRef.current
      if (!mm || !tree) return

      const freshTree = cloneMindMapTree(tree)
      mindMapCycleStateRef.current = nextState
      await mm.setData(freshTree, { initialExpandLevel: nextState.depth + 1 })
      await mm.fit()
    },
    [],
  )

  const stepMindMapCycle = useCallback(async () => {
    try {
      const currentState = mindMapCycleStateRef.current ?? getInitialCycleState()
      const nextState = getNextMindMapCycleState(currentState)
      await applyMindMapCycleState(nextState)
      const levelLabel = nextState.depth <= 1 ? '第 1 级' : `第 ${nextState.depth - 1} 级`
      showToast(`已切换到 ${levelLabel}`, 'success')
    } catch (error) {
      console.error('切换逐级展开失败:', error)
      showToast('逐级展开切换失败', 'error')
    }
  }, [applyMindMapCycleState, getInitialCycleState, showToast])

  const clearCycleTimers = useCallback(() => {
    if (cycleHoldTimerRef.current != null) {
      window.clearTimeout(cycleHoldTimerRef.current)
      cycleHoldTimerRef.current = null
    }
    if (cycleRepeatTimerRef.current != null) {
      window.clearInterval(cycleRepeatTimerRef.current)
      cycleRepeatTimerRef.current = null
    }
  }, [])

  const startCycleRepeat = useCallback(() => {
    clearCycleTimers()
    cycleHoldTimerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true
      void stepMindMapCycle()
      cycleRepeatTimerRef.current = window.setInterval(() => {
        void stepMindMapCycle()
      }, 220)
    }, 320)
  }, [clearCycleTimers, stepMindMapCycle])

  const customToolbarItems = useMemo(() => {
    return [
      {
        id: 'recurse',
        title: '逐级展开/折叠',
        content: createToolbarIcon('M16 4h-12v12h12v-8h-8v4h2v-2h4v4h-8v-8h10z', '逐级展开/折叠'),
        onClick: () => void stepMindMapCycle(),
      },
      {
        id: 'export-svg',
        title: '导出 SVG',
        content: createToolbarIcon('M5 4h8l4 4v8H5zM13 4v4h4M9 9v5M7.5 12.5 9 14l1.5-1.5', '导出 SVG'),
        onClick: () => void exportSvg(),
      },
      {
        id: 'export-png',
        title: '导出 PNG',
        content: createToolbarIcon('M4 6h12v8H4zM6 8h.01M7 12l2-2 3 3 2-2 2 2', '导出 PNG'),
        onClick: () => void exportPng(),
      },
      {
        id: 'export-html',
        title: '导出 HTML',
        content: createToolbarIcon('M8 6 4 10l4 4M12 6l4 4-4 4M10 4v12', '导出 HTML'),
        onClick: () => void exportHtml(),
      },
      {
        id: 'export-xmind',
        title: '导出 XMind',
        content: createToolbarIcon('M5 6h4M5 10h4M11 6h4M11 14h4M9 6v8M9 10h2M13 10v4', '导出 XMind'),
        onClick: () => void exportXMind(),
      },
    ]
  }, [exportHtml, exportPng, exportSvg, exportXMind, stepMindMapCycle])

  const commitToolbarPosition = useCallback((position: ToolbarPosition) => {
    toolbarPositionRef.current = position
    setToolbarPosition(position)
  }, [])

  const onToolbarPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (!target) return

    const recurseItem = target.closest<HTMLElement>('.mm-toolbar-item')
    const recurseLabel = recurseItem?.getAttribute('data-tooltip') || recurseItem?.getAttribute('title')
    if (recurseLabel === '逐级展开/折叠') {
      startCycleRepeat()
      return
    }

    if (target.closest('.mm-toolbar-item, .mm-toolbar-brand, button, a, input, textarea, select')) return
    if (!stageRef.current || !toolbarShellRef.current) return

    const stageRect = stageRef.current.getBoundingClientRect()
    const toolbarRect = toolbarShellRef.current.getBoundingClientRect()
    const currentPosition = toolbarPositionRef.current ?? {
      x: toolbarRect.left - stageRect.left,
      y: toolbarRect.top - stageRect.top,
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - (stageRect.left + currentPosition.x),
      offsetY: event.clientY - (stageRect.top + currentPosition.y),
      toolbarWidth: toolbarRect.width,
      toolbarHeight: toolbarRect.height,
    }
    commitToolbarPosition(currentPosition)
    setIsDraggingToolbar(true)
    setToolbarTooltip(null)
    document.documentElement.style.userSelect = 'none'
    event.preventDefault()
  }, [commitToolbarPosition, startCycleRepeat])

  const onToolbarPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current) return
    if (!toolbarShellRef.current) return

    const target = event.target as HTMLElement | null
    const item = target?.closest<HTMLElement>('.mm-toolbar-item, .mm-toolbar-brand')
    if (!item) {
      setToolbarTooltip(null)
      return
    }

    const label = item.getAttribute('data-tooltip') || item.getAttribute('title') || item.textContent?.trim()
    if (!label) {
      setToolbarTooltip(null)
      return
    }

    const shellRect = toolbarShellRef.current.getBoundingClientRect()
    const tooltipX = Math.min(Math.max(event.clientX - shellRect.left, 10), shellRect.width - 10)
    const tooltipY = Math.max(8, event.clientY - shellRect.top - 12)
    setToolbarTooltip({ text: label, x: tooltipX, y: tooltipY })
  }, [])

  const onToolbarPointerLeave = useCallback(() => {
    clearCycleTimers()
    if (!dragStateRef.current) {
      setToolbarTooltip(null)
    }
  }, [clearCycleTimers])

  useEffect(() => {
    toolbarPositionRef.current = toolbarPosition
  }, [toolbarPosition])

  useEffect(() => {
    const updateThemeMode = () => setThemeMode(getThemeMode())
    updateThemeMode()

    const observer = new MutationObserver(updateThemeMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || !hasContent) return
    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current)
    }
  }, [hasContent])

  useEffect(() => {
    if (!mmRef.current || !toolbarRef.current || !hasContent) return
    toolbarRef.current.innerHTML = ''
    const toolbar = new Toolbar()
    ;(toolbar as any).setBrand?.(false)
    toolbar.attach(mmRef.current)
    customToolbarItems.forEach((item) => toolbar.register(item))
    toolbar.setItems([
      'zoomIn',
      'zoomOut',
      'fit',
      'recurse',
      'export-svg',
      'export-png',
      'export-html',
      'export-xmind',
    ])
    const renderedToolbar = toolbar.render()
    toolbarRef.current.appendChild(renderedToolbar)
    attachToolbarTooltips(renderedToolbar)
  }, [customToolbarItems, hasContent])

  useEffect(() => {
    if (!hasContent || toolbarPosition) return
    const frame = window.requestAnimationFrame(() => {
      const stage = stageRef.current
      const toolbarShell = toolbarShellRef.current
      if (!stage || !toolbarShell) return
      const containerRect = stage.getBoundingClientRect()
      const toolbarRect = toolbarShell.getBoundingClientRect()
      const saved = loadToolbarPosition()
      const defaultPosition = saved ?? {
        x: Math.max(12, containerRect.width - toolbarRect.width - 12),
        y: 12,
      }
      const nextPosition = clampToolbarPosition(defaultPosition, containerRect.width, containerRect.height, toolbarRect.width, toolbarRect.height)
      commitToolbarPosition(nextPosition)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [commitToolbarPosition, hasContent, toolbarPosition])

  useEffect(() => {
    if (!toolbarPosition || !toolbarShellRef.current || !stageRef.current) return
    const handleResize = () => {
      if (!stageRef.current || !toolbarShellRef.current || !toolbarPositionRef.current) return
      const containerRect = stageRef.current.getBoundingClientRect()
      const toolbarRect = toolbarShellRef.current.getBoundingClientRect()
      const nextPosition = clampToolbarPosition(
        toolbarPositionRef.current,
        containerRect.width,
        containerRect.height,
        toolbarRect.width,
        toolbarRect.height,
      )
      commitToolbarPosition(nextPosition)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [commitToolbarPosition, toolbarPosition])

  useEffect(() => {
    if (!isDraggingToolbar) return

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState || !stageRef.current) return
      const containerRect = stageRef.current.getBoundingClientRect()
      const nextPosition = clampToolbarPosition(
        {
          x: event.clientX - containerRect.left - dragState.offsetX,
          y: event.clientY - containerRect.top - dragState.offsetY,
        },
        containerRect.width,
        containerRect.height,
        dragState.toolbarWidth,
        dragState.toolbarHeight,
      )
      commitToolbarPosition(nextPosition)
    }

    const finishDrag = (event?: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return
      if (event && dragState.pointerId !== event.pointerId) return
      dragStateRef.current = null
      setIsDraggingToolbar(false)
      document.documentElement.style.userSelect = ''
      if (toolbarPositionRef.current) {
        saveToolbarPosition(toolbarPositionRef.current)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [commitToolbarPosition, isDraggingToolbar])

  useEffect(() => {
    const mm = mmRef.current
    if (!mm || !hasContent || !mindMapTree) return
    mindMapTreeRef.current = cloneMindMapTree(mindMapTree)
    const initialCycleState = getInitialCycleState()
    mindMapCycleStateRef.current = initialCycleState
    void mm.setData(cloneMindMapTree(mindMapTree), { initialExpandLevel: initialCycleState.depth + 1 }).then(() => mm.fit())
  }, [getInitialCycleState, hasContent, mindMapTree])

  useEffect(() => {
    return () => {
      clearCycleTimers()
    }
  }, [clearCycleTimers])

  useEffect(() => {
    return () => {
      document.documentElement.style.userSelect = ''
    }
  }, [])

  if (!hasContent) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center text-sm text-[var(--color-text-secondary)]">
        暂无可展示的导图内容
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'mindmap-tab relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--color-bg-primary)]',
        themeMode === 'dark' && 'markmap-dark',
      )}
      style={themeStyle}
    >
      <style>{`
        .mindmap-tab svg {
          width: 100%;
          height: 100%;
        }
        .mindmap-tab .mindmap-toolbar-shell {
          touch-action: none;
        }
        .mindmap-tab .mm-toolbar-item > *,
        .mindmap-tab .mm-toolbar-brand > * {
          pointer-events: none;
        }
        .mindmap-tab .mm-toolbar-item,
        .mindmap-tab .mm-toolbar-brand {
          position: relative;
        }
        .mindmap-tab .mindmap-toolbar-tooltip {
          position: absolute;
          transform: translate(-50%, -100%);
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(17, 24, 39, 0.96);
          color: #f8fafc;
          font-size: 12px;
          line-height: 1;
          white-space: nowrap;
          z-index: 60;
          pointer-events: none;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
          opacity: 0.98;
        }
        .dark .mindmap-tab .mindmap-toolbar-tooltip,
        .markmap-dark .mindmap-tab .mindmap-toolbar-tooltip {
          background: rgba(31, 41, 55, 0.98);
          color: #e5e7eb;
        }
      `}</style>
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <div
          ref={toolbarShellRef}
          className={clsx(
            'mindmap-toolbar-shell absolute z-20 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)]/90 backdrop-blur',
            isDraggingToolbar && 'cursor-grabbing',
            !isDraggingToolbar && 'cursor-grab',
          )}
          style={
            toolbarPosition
              ? {
                  backgroundColor: themeMode === 'dark' ? 'rgba(24, 27, 38, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                  left: `${toolbarPosition.x}px`,
                  top: `${toolbarPosition.y}px`,
                }
              : {
                  backgroundColor: themeMode === 'dark' ? 'rgba(24, 27, 38, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                  right: '12px',
                  top: '12px',
                }
          }
          onPointerDown={onToolbarPointerDown}
          onPointerMove={onToolbarPointerMove}
          onPointerLeave={onToolbarPointerLeave}
          onPointerUp={clearCycleTimers}
          onClickCapture={(event) => {
            const target = event.target as HTMLElement | null
            const recurseItem = target?.closest('.mm-toolbar-item')
            if (!recurseItem) return
            if (!suppressNextClickRef.current) return
            suppressNextClickRef.current = false
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <div ref={toolbarRef} />
          {toolbarTooltip ? (
            <div
              className="mindmap-toolbar-tooltip"
              style={{
                left: `${toolbarTooltip.x}px`,
                top: `${toolbarTooltip.y}px`,
              }}
            >
              {toolbarTooltip.text}
            </div>
          ) : null}
        </div>
        <svg ref={svgRef} className="mindmap-tab h-full w-full" />
      </div>
    </div>
  )
}
