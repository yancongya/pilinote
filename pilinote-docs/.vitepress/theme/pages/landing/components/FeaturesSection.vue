<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { prefersReducedMotion } from '../../../lib/motion'
import { FEATURES } from '../content'
import CapNotesSvg from './cap-svg/CapNotesSvg.vue'
import CapQueueSvg from './cap-svg/CapQueueSvg.vue'
import CapDownloadSvg from './cap-svg/CapDownloadSvg.vue'
import CapLibrarySvg from './cap-svg/CapLibrarySvg.vue'
import CapPromptSvg from './cap-svg/CapPromptSvg.vue'
import CapLocalSvg from './cap-svg/CapLocalSvg.vue'
import CapBackupSvg from './cap-svg/CapBackupSvg.vue'

type Capability = {
  title: string
  desc: string
  bullets: string[]
  signals: string[]
  meta: string
}

type CapabilityVisual = {
  kind: 'notes' | 'queue' | 'download' | 'library' | 'prompt' | 'local' | 'backup'
  component:
    | typeof CapNotesSvg
    | typeof CapQueueSvg
    | typeof CapDownloadSvg
    | typeof CapLibrarySvg
    | typeof CapPromptSvg
    | typeof CapLocalSvg
    | typeof CapBackupSvg
}

type CardBox = {
  x: number
  y: number
  w: number
  h: number
}

const rootRef = ref<HTMLElement | null>(null)
const tickerViewportRef = ref<HTMLElement | null>(null)
const tickerTrackRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const collageLayoutIndex = ref(0)
const activeTickerIndex = ref(0)
let autoTimer: ReturnType<typeof setInterval> | undefined
let layoutTimer: ReturnType<typeof setInterval> | undefined
let resumeTimer: ReturnType<typeof setTimeout> | undefined
let tickerCycleTimer: ReturnType<typeof setInterval> | undefined
type GsapLike = {
  to: (...args: any[]) => any
  fromTo: (...args: any[]) => any
}
let tickerTween: { kill: () => void; timeScale: (value: number) => void } | undefined
let tickerPulseTween: { kill: () => void } | undefined
let tickerEnterHandler: (() => void) | undefined
let tickerLeaveHandler: (() => void) | undefined

const capabilities: Capability[] = [
  {
    ...FEATURES[0],
    signals: ['章节定位 03:24', '关键问题 8 条', '复习路径已生成'],
    meta: 'AI Notes',
  },
  {
    ...FEATURES[1],
    signals: ['增量扫描 +12', '重复内容已跳过', '自动加入队列'],
    meta: 'Queue',
  },
  {
    ...FEATURES[2],
    signals: ['并发 3 个任务', '失败自动重试', '分 P 顺序处理'],
    meta: 'Download',
  },
  {
    ...FEATURES[3],
    signals: ['媒体索引可检索', '字幕联动预览', '本地路径可迁移'],
    meta: 'Library',
  },
  {
    ...FEATURES[4],
    signals: ['Prompt 模板可切换', '模型策略可调整', '链路日志可检查'],
    meta: 'Prompt',
  },
  {
    title: '纯本地化知识处理',
    desc: '视频、字幕、截图、NFO 和 AI 笔记都沉淀到本地目录，复习链路不依赖在线平台状态。',
    bullets: ['本地目录可迁移', 'sidecar 同级归档', '离线复习更稳定'],
    signals: ['离线仍可检索', '链接失效不影响复习', '知识资产在本地'],
    meta: 'Local First',
  },
  {
    title: 'FTP / NAS 备份',
    desc: '把长期收藏的视频资产同步到 NAS 或远程存储，适合多设备访问和长期归档。',
    bullets: ['目录结构稳定', '适合长期收藏', '远程备份可扩展'],
    signals: ['NAS 同步待机', '多设备访问', '长期归档策略'],
    meta: 'Backup',
  },
]

const visuals: CapabilityVisual[] = [
  { kind: 'notes', component: CapNotesSvg },
  { kind: 'queue', component: CapQueueSvg },
  { kind: 'download', component: CapDownloadSvg },
  { kind: 'library', component: CapLibrarySvg },
  { kind: 'prompt', component: CapPromptSvg },
  { kind: 'local', component: CapLocalSvg },
  { kind: 'backup', component: CapBackupSvg },
]

const activeCapability = computed(() => capabilities[activeIndex.value] ?? capabilities[0])
const activeVisual = computed(() => visuals[activeIndex.value] ?? visuals[0])
type ExtraFeature = { title: string; detail: string }
const extraFeatures: ExtraFeature[] = [
  { title: '主页链接解析', detail: '在首页直接粘贴 B 站链接后解析视频元数据，支持批量追加到下载队列。' },
  { title: '收藏夹/稍后再看自动入队', detail: '按 cron 周期增量扫描收藏夹与稍后再看，新增内容自动进入处理链路。' },
  { title: 'AI 字幕下载', detail: '字幕可按语言策略自动拉取，并与视频本体同级归档，便于后续检索和复盘。' },
  { title: '字幕 AI 纠正', detail: '对时间轴错位、口语误识别做二次纠偏，提升章节提取与问答召回质量。' },
  { title: 'ASR 本地模型', detail: '支持本地 ASR 推理，弱网或离线场景也可完成转写与基础语义切分。' },
  { title: '笔记导出文章', detail: '将章节摘要、关键问题与时间戳回跳整合为结构化文章，便于分享与归档。' },
  { title: '章节自动切分', detail: '基于字幕语义和停顿特征生成章节边界，形成可回跳的学习路径。' },
  { title: 'NFO 同级归档', detail: '下载后自动生成 NFO / sidecar，并与媒体文件保持同目录统一管理。' },
  { title: '失败重试 + 并发调度', detail: '任务失败可重试并保留状态，队列按并发策略运行，减少人工干预成本。' },
  { title: 'NAS / FTP 长期备份', detail: '本地资产可同步至 NAS 或 FTP，实现跨设备访问与长期冷备保存。' },
]
const tickerItems = computed(() => [...extraFeatures, ...extraFeatures])
const activeTickerText = computed(() => extraFeatures[activeTickerIndex.value] ?? extraFeatures[0])
const collageLayouts: CardBox[][] = [
  [
    { x: 2, y: 3, w: 31, h: 27 },
    { x: 35, y: 3, w: 35, h: 25 },
    { x: 72, y: 3, w: 26, h: 28 },
    { x: 2, y: 33, w: 42, h: 32 },
    { x: 46, y: 31, w: 52, h: 30 },
    { x: 2, y: 68, w: 48, h: 29 },
    { x: 52, y: 64, w: 46, h: 33 },
  ],
  [
    { x: 2, y: 3, w: 43, h: 31 },
    { x: 47, y: 3, w: 24, h: 28 },
    { x: 73, y: 3, w: 25, h: 31 },
    { x: 2, y: 37, w: 30, h: 34 },
    { x: 34, y: 34, w: 64, h: 35 },
    { x: 2, y: 74, w: 40, h: 23 },
    { x: 44, y: 72, w: 54, h: 25 },
  ],
  [
    { x: 2, y: 4, w: 27, h: 39 },
    { x: 31, y: 4, w: 42, h: 25 },
    { x: 75, y: 4, w: 23, h: 39 },
    { x: 31, y: 32, w: 34, h: 31 },
    { x: 67, y: 46, w: 31, h: 23 },
    { x: 2, y: 46, w: 27, h: 51 },
    { x: 31, y: 66, w: 67, h: 31 },
  ],
  [
    { x: 2, y: 3, w: 28, h: 26 },
    { x: 32, y: 3, w: 30, h: 41 },
    { x: 64, y: 3, w: 34, h: 26 },
    { x: 2, y: 32, w: 28, h: 39 },
    { x: 64, y: 32, w: 34, h: 39 },
    { x: 2, y: 74, w: 60, h: 23 },
    { x: 64, y: 74, w: 34, h: 23 },
  ],
]
const activeCollageLayout = computed(() => collageLayouts[collageLayoutIndex.value] ?? collageLayouts[0])

function clearAutoTimer() {
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = undefined
  }
}

function clearLayoutTimer() {
  if (layoutTimer) {
    clearInterval(layoutTimer)
    layoutTimer = undefined
  }
}

function clearTickerCycleTimer() {
  if (tickerCycleTimer) {
    clearInterval(tickerCycleTimer)
    tickerCycleTimer = undefined
  }
}

function startAutoTimer() {
  clearAutoTimer()
  autoTimer = setInterval(() => {
    void setActive((activeIndex.value + 1) % capabilities.length, false)
  }, 3600)
}

function cycleCollageLayout() {
  let next = Math.floor(Math.random() * collageLayouts.length)
  if (next === collageLayoutIndex.value) next = (next + 1) % collageLayouts.length
  collageLayoutIndex.value = next
}

function startLayoutTimer() {
  clearLayoutTimer()
  layoutTimer = setInterval(() => {
    cycleCollageLayout()
  }, 2400)
}

function startTickerCycle() {
  clearTickerCycleTimer()
  tickerCycleTimer = setInterval(() => {
    activeTickerIndex.value = (activeTickerIndex.value + 1) % extraFeatures.length
  }, 2600)
}

function setupTickerMotion(gsap: GsapLike) {
  const viewport = tickerViewportRef.value
  const track = tickerTrackRef.value
  if (!viewport || !track || prefersReducedMotion()) return

  tickerTween?.kill()
  tickerPulseTween?.kill()

  tickerTween = gsap.to(track, {
    xPercent: -50,
    duration: 28,
    ease: 'none',
    repeat: -1,
  })

  tickerPulseTween = gsap.to('[data-ticker-chip]', {
    keyframes: [
      { borderColor: 'rgb(var(--pn-accent-rgb) / 0.2)', duration: 0.2 },
      { borderColor: 'rgb(var(--pn-accent-rgb) / 0.52)', duration: 0.42 },
      { borderColor: 'rgb(var(--pn-accent-rgb) / 0.2)', duration: 0.35 },
    ],
    stagger: 0.12,
    repeat: -1,
    repeatDelay: 2.4,
    ease: 'power2.inOut',
  })

  tickerEnterHandler = () => tickerTween?.timeScale(0.35)
  tickerLeaveHandler = () => tickerTween?.timeScale(1)
  viewport.addEventListener('mouseenter', tickerEnterHandler)
  viewport.addEventListener('mouseleave', tickerLeaveHandler)
}

async function setActive(index: number, shouldPause = true) {
  if (index === activeIndex.value) return

  if (shouldPause) {
    clearAutoTimer()
    if (resumeTimer) clearTimeout(resumeTimer)
    resumeTimer = setTimeout(() => {
      startAutoTimer()
    }, 5200)
  }

  activeIndex.value = index
}

async function setupMotion() {
  if (!rootRef.value || prefersReducedMotion()) return
  const { default: gsap } = await import('gsap')

  startAutoTimer()
  startLayoutTimer()
  startTickerCycle()
  setupTickerMotion(gsap)

  gsap.fromTo(
    rootRef.value.querySelector('[data-cap-ticker]'),
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.56, ease: 'power2.out', delay: 0.12 },
  )
}

onMounted(() => {
  void setupMotion()
})

onBeforeUnmount(() => {
  clearAutoTimer()
  clearLayoutTimer()
  clearTickerCycleTimer()
  tickerTween?.kill()
  tickerPulseTween?.kill()
  if (tickerViewportRef.value && tickerEnterHandler && tickerLeaveHandler) {
    tickerViewportRef.value.removeEventListener('mouseenter', tickerEnterHandler)
    tickerViewportRef.value.removeEventListener('mouseleave', tickerLeaveHandler)
  }
  if (resumeTimer) clearTimeout(resumeTimer)
})
</script>

<template>
  <section id="features" ref="rootRef" class="lp2-section" data-reveal>
    <div class="lp2-container">
      <div class="lp2-section-head">
        <h2 class="lp2-h2">核心能力</h2>
        <p class="lp2-sub">能力不是静态清单，而是一组围绕“本地知识库”的处理模块：采集、落盘、分析、回跳、备份。</p>
      </div>

      <div class="cap-stage">
        <article class="cap-hero" data-cap-hero>
          <div class="cap-hero-top">
            <span>{{ activeCapability.meta }}</span>
            <b>{{ String(activeIndex + 1).padStart(2, '0') }}</b>
          </div>
          <Transition name="cap-copy" mode="out-in">
            <div :key="activeCapability.title" class="cap-copy">
              <h3>{{ activeCapability.title }}</h3>
              <p class="cap-desc">
                <span>{{ activeCapability.desc }}</span>
              </p>
            </div>
          </Transition>

          <div class="cap-canvas" aria-hidden="true">
            <Transition name="cap-art" mode="out-in">
              <component :is="activeVisual.component" :key="activeVisual.kind" :active="true" />
            </Transition>
          </div>

          <div class="cap-hero-bottom">
            <Transition name="cap-copy" mode="out-in">
              <ul :key="activeCapability.meta" class="cap-points">
                <li v-for="point in activeCapability.bullets" :key="point">{{ point }}</li>
              </ul>
            </Transition>
          </div>
        </article>

        <div class="cap-collage" aria-label="核心能力拼贴">
          <button
            v-for="(capability, index) in capabilities"
            :key="capability.title"
            data-cap-card
            class="cap-card"
            :class="{ 'is-active': activeIndex === index }"
            :style="{
              left: `${activeCollageLayout[index].x}%`,
              top: `${activeCollageLayout[index].y}%`,
              width: `${activeCollageLayout[index].w}%`,
              height: `${activeCollageLayout[index].h}%`,
            }"
            type="button"
            @click="setActive(index)"
            @focus="setActive(index)"
          >
            <span class="cap-card-meta">{{ capability.meta }}</span>
            <strong>{{ capability.title }}</strong>
            <small>{{ capability.signals[0] }}</small>
          </button>
        </div>
      </div>

      <div class="cap-ticker" data-cap-ticker>
        <div class="cap-ticker-head">
          <span>扩展能力</span>
          <b>{{ activeTickerText.title }}</b>
          <em>{{ activeTickerText.detail }}</em>
        </div>
        <div ref="tickerViewportRef" class="cap-ticker-viewport">
          <div ref="tickerTrackRef" class="cap-ticker-track">
            <button
              v-for="(item, index) in tickerItems"
              :key="`${item.title}-${index}`"
              data-ticker-chip
              class="cap-ticker-chip"
              type="button"
              :class="{ 'is-active': index % extraFeatures.length === activeTickerIndex }"
              @click="activeTickerIndex = index % extraFeatures.length"
            >
              <span>{{ item.title }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lp2-section {
  padding: 64px 0;
}

.lp2-container {
  max-width: 1200px;
  padding: 0 18px;
  margin: 0 auto;
}

.lp2-section-head {
  margin-bottom: 18px;
}

.lp2-h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
  line-height: 1.25;
}

.lp2-sub {
  margin: 0;
  color: var(--pn-muted);
  line-height: 1.6;
  font-size: 14px;
  max-width: 72ch;
}

.cap-stage {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  align-items: stretch;
  gap: 14px;
  height: 430px;
}

.cap-ticker {
  margin-top: 12px;
  border: 1px solid var(--pn-border);
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(520px 120px at 10% 0%, rgb(var(--pn-accent-rgb) / 0.1), transparent 62%),
    radial-gradient(520px 120px at 90% 0%, rgb(var(--pn-blue-rgb) / 0.1), transparent 62%),
    color-mix(in srgb, var(--pn-bg) 72%, transparent);
}

.cap-ticker-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--pn-border) 76%, transparent);
  background: color-mix(in srgb, var(--pn-bg) 64%, transparent);
}

.cap-ticker-head span {
  font-size: 11px;
  color: var(--pn-muted);
  border: 1px solid var(--pn-border);
  border-radius: 999px;
  padding: 3px 8px;
}

.cap-ticker-head b {
  color: color-mix(in srgb, var(--pn-fg) 94%, transparent);
  font-size: 12px;
  font-weight: 500;
}

.cap-ticker-head em {
  color: var(--pn-muted);
  font-size: 12px;
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cap-ticker-viewport {
  overflow: hidden;
  padding: 8px 0 10px;
}

.cap-ticker-track {
  width: max-content;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
}

.cap-ticker-chip {
  border: 1px solid color-mix(in srgb, var(--pn-border) 82%, transparent);
  background: color-mix(in srgb, var(--pn-bg) 66%, transparent);
  color: var(--pn-muted);
  border-radius: 999px;
  height: 28px;
  line-height: 1;
  padding: 0 12px;
  font-size: 12px;
  letter-spacing: 0;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 0;
  transition: transform 180ms ease, border-color 180ms ease, color 180ms ease, background 180ms ease;
}

.cap-ticker-chip span {
  color: color-mix(in srgb, var(--pn-fg) 90%, transparent);
}

.cap-ticker-chip:hover {
  transform: translateY(-1px);
  color: var(--pn-fg);
}

.cap-ticker-chip.is-active {
  color: var(--pn-fg);
  border-color: rgb(var(--pn-accent-rgb) / 0.52);
  background: color-mix(in srgb, var(--pn-card) 72%, rgb(var(--pn-accent-rgb) / 0.1));
}

.cap-hero,
.cap-collage {
  border: 1px solid var(--pn-border);
  background:
    radial-gradient(600px 220px at 12% 6%, rgb(var(--pn-accent-rgb) / 0.14), transparent 62%),
    radial-gradient(640px 220px at 88% 18%, rgb(var(--pn-blue-rgb) / 0.12), transparent 60%),
    var(--pn-card);
}

.cap-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: 22px;
  padding: 16px;
  box-shadow: var(--pn-soft-shadow);
}

.cap-hero::after {
  content: '';
  position: absolute;
  inset: auto 18px 18px auto;
  width: 130px;
  height: 130px;
  border-radius: 999px;
  border: 1px solid rgb(var(--pn-blue-rgb) / 0.22);
  background: radial-gradient(circle, rgb(var(--pn-blue-rgb) / 0.14), transparent 68%);
  pointer-events: none;
}

.cap-hero-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.cap-hero-top span,
.cap-hero-top b {
  border-radius: 999px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 68%, transparent);
  padding: 6px 10px;
  color: var(--pn-muted);
  font-size: 12px;
}

.cap-hero-top b {
  color: rgb(var(--pn-accent-rgb));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.cap-copy {
  position: relative;
  z-index: 1;
}

.cap-copy-enter-active,
.cap-copy-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.cap-copy-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.cap-copy-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.cap-art-enter-active,
.cap-art-leave-active {
  transition: opacity 240ms ease, transform 240ms ease;
}

.cap-art-enter-from,
.cap-art-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.cap-hero h3 {
  position: relative;
  z-index: 1;
  margin: 0;
  color: var(--pn-fg);
  font-size: 28px;
  line-height: 1.18;
  letter-spacing: 0;
}

.cap-desc {
  position: relative;
  z-index: 1;
  margin: 12px 0 0;
  color: var(--pn-muted);
  font-size: 14px;
  line-height: 28px;
  height: 28px;
  overflow: hidden;
  white-space: nowrap;
  mask-image: linear-gradient(90deg, transparent, #000 8%, #000 86%, transparent);
}

.cap-desc span {
  display: inline-block;
  min-width: 100%;
  padding-right: 36px;
  animation: cap-marquee 10s linear infinite;
}

.cap-canvas {
  position: relative;
  z-index: 0;
  margin: 14px -2px 10px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--pn-border) 78%, transparent);
  background:
    linear-gradient(color-mix(in srgb, var(--pn-fg) 5%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--pn-fg) 5%, transparent) 1px, transparent 1px),
    color-mix(in srgb, var(--pn-bg) 56%, transparent);
  background-size: 28px 28px;
  overflow: hidden;
}

.cap-canvas :deep(svg) {
  display: block;
  width: 100%;
  height: 126px;
}

.cap-hero-bottom {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: auto;
}

.cap-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.cap-points li {
  border-radius: 11px;
  border: 1px solid color-mix(in srgb, var(--pn-border) 82%, transparent);
  background: color-mix(in srgb, var(--pn-bg) 70%, transparent);
  color: var(--pn-muted);
  padding: 7px 10px;
  font-size: 12px;
}

.cap-collage {
  position: relative;
  height: 100%;
  min-height: 0;
  border-radius: 22px;
  overflow: hidden;
}

.cap-card {
  position: absolute;
  container-type: size;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 72%, transparent);
  color: var(--pn-fg);
  padding: 12px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 14px 42px rgb(15 23 42 / 0.04);
  transition:
    left 760ms cubic-bezier(0.22, 1, 0.36, 1),
    top 760ms cubic-bezier(0.22, 1, 0.36, 1),
    width 760ms cubic-bezier(0.22, 1, 0.36, 1),
    height 760ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
  will-change: left, top, width, height;
}

.cap-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(180px 120px at 18% 8%, rgb(var(--pn-accent-rgb) / 0.16), transparent 64%),
    radial-gradient(180px 120px at 90% 88%, rgb(var(--pn-blue-rgb) / 0.14), transparent 64%);
  opacity: 0;
  transition: opacity 180ms ease;
  pointer-events: none;
}

.cap-card.is-active {
  border-color: rgb(var(--pn-accent-rgb) / 0.36);
  background: color-mix(in srgb, var(--pn-card-2) 86%, transparent);
  box-shadow: var(--pn-soft-shadow);
}

.cap-card:hover {
  transform: translateY(-2px);
}

.cap-card:focus-visible {
  outline: 2px solid rgb(var(--pn-blue-rgb) / 0.5);
  outline-offset: 2px;
}

.cap-card.is-active::before,
.cap-card:hover::before {
  opacity: 1;
}

.cap-card-meta,
.cap-card strong,
.cap-card small {
  position: relative;
  z-index: 1;
}

.cap-card-meta {
  flex: 0 0 auto;
  max-width: 100%;
  border-radius: 999px;
  background: rgb(var(--pn-accent-rgb) / 0.1);
  color: rgb(var(--pn-accent-rgb));
  padding: 4px 8px;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.cap-card strong {
  flex: 0 1 auto;
  display: -webkit-box;
  color: var(--pn-fg);
  font-size: 15px;
  line-height: 1.3;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.cap-card small {
  flex: 0 0 auto;
  margin-top: auto;
  color: var(--pn-muted);
  font-size: 12px;
  overflow: hidden;
  max-width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

@container (max-height: 118px) {
  .cap-card {
    gap: 6px;
    padding: 10px;
  }
  .cap-card strong {
    font-size: 14px;
    -webkit-line-clamp: 1;
  }
  .cap-card small {
    display: none;
  }
}

@container (max-width: 150px) {
  .cap-card {
    padding: 10px;
  }
  .cap-card-meta {
    max-width: 78%;
  }
  .cap-card strong {
    font-size: 14px;
  }
}

@keyframes cap-marquee {
  0%,
  18% {
    transform: translateX(0);
  }
  82%,
  100% {
    transform: translateX(-38%);
  }
}

@media (max-width: 980px) {
  .cap-stage {
    grid-template-columns: 1fr;
    height: auto;
  }
  .cap-hero,
  .cap-collage {
    height: auto;
    min-height: auto;
  }
  .cap-collage {
    height: 430px;
  }
}

@media (max-width: 680px) {
  .lp2-section {
    padding: 44px 0;
  }
  .lp2-container {
    padding: 0 12px;
  }
  .cap-hero {
    padding: 14px;
  }
  .cap-hero h3 {
    font-size: 22px;
  }
  .cap-canvas :deep(svg) {
    height: 120px;
  }
  .cap-collage {
    height: 520px;
  }
  .cap-ticker {
    margin-top: 10px;
  }
  .cap-ticker-head {
    padding: 7px 10px;
  }
  .cap-ticker-chip {
    height: 26px;
    line-height: 24px;
    font-size: 11px;
    padding: 0 10px;
  }
}
</style>
