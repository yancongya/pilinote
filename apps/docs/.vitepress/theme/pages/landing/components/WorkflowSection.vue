<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { prefersReducedMotion } from '../../../lib/motion'

const rootRef = ref<HTMLElement | null>(null)
const fileListRef = ref<HTMLElement | null>(null)
let cleanup: (() => void) | undefined
let timeline: { restart: () => void; kill: () => void } | undefined
let startTimer: ReturnType<typeof setTimeout> | undefined

const sources = [
  { id: 'favorites', label: '收藏夹', sample: 'Vue3 进阶实战' },
  { id: 'watchlater', label: '稍后再看', sample: 'LLM 笔记工作流实战' },
  { id: 'history', label: '观看历史', sample: 'FastAPI 队列设计' },
  { id: 'subscriptions', label: '订阅文件夹', sample: 'AI 工具链复盘' },
  { id: 'manual', label: '手动解析', sample: 'BV1xx 链接解析' },
]

const steps = [
  { title: '入队', meta: 'Queue', status: '已添加到下载列表' },
  { title: '下载', meta: 'Download', status: '下载视频与字幕' },
  { title: 'sidecar', meta: 'Files', status: '生成 NFO、字幕、截图' },
  { title: 'Prompt', meta: 'Context', status: '构建分析 Prompt' },
  { title: 'AI 分析', meta: 'Notes', status: '生成章节与关键点' },
  { title: '回跳笔记', meta: 'Review', status: '时间戳可回跳复习' },
]

const artifacts = [
  'video.mp4',
  'subtitle.srt',
  'video.nfo',
  'comments.json',
  'cover.jpg',
  'prompt.context.md',
  'note.ai-note.md',
  'chapter-summary.md',
  'jumpback-index.json',
]

const activeSource = ref(sources[1])
const cronEnabled = ref(true)
const activeStep = ref(0)
const progressPercent = ref(12)
const visibleArtifacts = ref(0)

const taskTitle = computed(() => activeSource.value.sample)
const activeStatus = computed(() => steps[activeStep.value]?.status ?? steps[0].status)
const progressBarText = computed(() => {
  const total = 18
  const filled = Math.round((progressPercent.value / 100) * total)
  return `[${'█'.repeat(filled)}${'░'.repeat(total - filled)}]`
})
const taskPosition = computed(() => {
  const max = Math.max(steps.length - 1, 1)
  const percent = (activeStep.value / max) * 100
  return `clamp(58px, ${percent}%, calc(100% - 58px))`
})

function setSource(source: typeof sources[number]) {
  activeSource.value = source
  replay()
}

function replay() {
  if (startTimer) {
    clearTimeout(startTimer)
    startTimer = undefined
  }
  timeline?.restart()
}

async function setupMotion() {
  if (!rootRef.value || prefersReducedMotion()) {
    activeStep.value = steps.length - 1
    progressPercent.value = 100
    visibleArtifacts.value = artifacts.length
    return
  }

  const { gsap } = await import('gsap')
  const root = rootRef.value
  const statusPanel = root.querySelector('[data-status-panel]')

  const tl = gsap.timeline({
    paused: true,
    repeat: -1,
    repeatDelay: 5,
    defaults: { duration: 0.34, ease: 'power2.out' },
  })

  steps.forEach((step, index) => {
    tl.call(() => {
      activeStep.value = index
      progressPercent.value = index === 1 || index === 4 ? 8 : Math.min(100, 16 + index * 14)
      if (index < 2) visibleArtifacts.value = 0
      if (index === 2) visibleArtifacts.value = 3
      if (index === 3) visibleArtifacts.value = 4
      if (index === 4) visibleArtifacts.value = 6
      if (index >= 5) visibleArtifacts.value = artifacts.length
    })
      .fromTo(statusPanel, { autoAlpha: 0.72, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.22 }, '<')

    if (index === 1 || index === 4) {
      const state = { percent: 8 }
      tl.to(state, {
        percent: 100,
        duration: 0.58,
        ease: 'power2.inOut',
        onUpdate: () => {
          progressPercent.value = Math.round(state.percent)
        },
      })
    } else {
      tl.to({}, { duration: 0.34 })
    }
  })

  startTimer = setTimeout(() => {
    tl.play(0)
  }, 5000)
  cleanup = () => {
    if (startTimer) clearTimeout(startTimer)
    tl.kill()
  }
  timeline = tl
}

onMounted(() => {
  void setupMotion()
})

watch(visibleArtifacts, async () => {
  await nextTick()
  const list = fileListRef.value
  if (!list) return
  list.scrollTo({ top: list.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
})

onBeforeUnmount(() => {
  cleanup?.()
})
</script>

<template>
  <section id="workflow" ref="rootRef" class="lp2-section" data-reveal>
    <div class="lp2-container">
      <div class="lp2-section-head">
        <h2 class="lp2-h2">工作流</h2>
        <p class="lp2-sub">
          选择视频来源，手动或按 cron 加入下载列表，再自动落盘、生成 sidecar、构建 Prompt 并输出可回跳笔记。
        </p>
      </div>

      <div class="wf-shell">
        <div class="wf-sources" aria-label="视频来源">
          <button
            v-for="source in sources"
            :key="source.id"
            class="wf-source"
            :class="{ 'is-active': activeSource.id === source.id }"
            type="button"
            @click="setSource(source)"
          >
            {{ source.label }}
          </button>
        </div>

        <div class="wf-manual">
          <span class="wf-link">https://www.bilibili.com/video/BV...</span>
          <button class="wf-parse" type="button" @click="setSource(sources[4])">解析并入队</button>
          <label class="wf-cron">
            <input v-model="cronEnabled" type="checkbox" />
            <span>cron 自动扫描</span>
            <b>每 6 小时</b>
          </label>
        </div>

        <div class="wf-pipeline">
          <div class="wf-rail" aria-hidden="true">
            <span class="wf-rail-line" />
            <span class="wf-task" :style="{ left: taskPosition }">
              <b>{{ taskTitle }}</b>
              <small>{{ activeSource.label }}</small>
            </span>
          </div>

          <ol class="wf-nodes">
            <li
              v-for="(step, index) in steps"
              :key="step.title"
              class="wf-node"
              :class="{ 'is-active': activeStep === index, 'is-done': activeStep > index }"
            >
              <span>{{ index + 1 }}</span>
              <strong>{{ step.title }}</strong>
              <em>{{ step.meta }}</em>
            </li>
          </ol>
        </div>

        <div class="wf-bottom">
          <div class="wf-status" data-status-panel>
            <div class="wf-status-kicker">当前状态</div>
            <div class="wf-status-title">{{ activeStatus }}</div>
            <div class="wf-cli-meter" aria-label="进度">
              <span class="wf-cli-label">$ run</span>
              <span class="wf-cli-bar">{{ progressBarText }}</span>
              <span class="wf-cli-value">{{ progressPercent }}%</span>
            </div>
          </div>

          <div class="wf-artifacts" aria-label="生成产物">
            <div class="wf-status-kicker">本地资产包</div>
            <div ref="fileListRef" class="wf-file-list">
              <div
                v-for="(file, index) in artifacts"
                :key="file"
                data-flow-artifact
                class="wf-file-row"
                :class="{ 'is-visible': index < visibleArtifacts }"
              >
                <span class="wf-file-name">{{ file }}</span>
              </div>
            </div>
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
  max-width: 76ch;
}

.wf-shell {
  border-radius: 20px;
  border: 1px solid var(--pn-border);
  background:
    radial-gradient(900px 260px at 12% 0%, rgb(var(--pn-accent-rgb) / 0.11), transparent 62%),
    radial-gradient(740px 260px at 88% 6%, rgb(var(--pn-blue-rgb) / 0.11), transparent 60%),
    var(--pn-card);
  padding: 16px;
  overflow: hidden;
}

.wf-sources,
.wf-manual {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.wf-source,
.wf-parse {
  height: 34px;
  border: 1px solid var(--pn-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--pn-bg) 72%, transparent);
  color: var(--pn-muted);
  padding: 0 11px;
  font-size: 13px;
  cursor: pointer;
}

.wf-source.is-active,
.wf-parse {
  color: var(--pn-fg);
  border-color: rgb(var(--pn-accent-rgb) / 0.28);
  background: rgb(var(--pn-accent-rgb) / 0.14);
}

.wf-manual {
  margin-top: 10px;
}

.wf-link {
  min-width: min(100%, 310px);
  border: 1px solid var(--pn-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--pn-fg) 4%, transparent);
  color: var(--pn-muted);
  font-size: 12px;
  padding: 8px 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.wf-cron {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--pn-muted);
  font-size: 12px;
}

.wf-cron input {
  accent-color: rgb(var(--pn-accent-rgb));
}

.wf-cron b {
  color: var(--pn-fg);
  font-weight: 650;
}

.wf-pipeline {
  margin-top: 18px;
  border: 1px solid var(--pn-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--pn-bg) 64%, transparent);
  padding: 18px 14px 14px;
}

.wf-rail {
  height: 54px;
  position: relative;
  margin: 0 18px 8px;
}

.wf-rail-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(var(--pn-accent-rgb) / 0.62), rgb(var(--pn-blue-rgb) / 0.48));
}

.wf-task {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 116px;
  max-width: 116px;
  border-radius: 12px;
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.28);
  background: var(--pn-app-bg);
  box-shadow: var(--pn-soft-shadow);
  padding: 7px 8px;
  transition: left 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.wf-task b,
.wf-task small {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.wf-task b {
  color: var(--pn-fg);
  font-size: 11px;
}

.wf-task small {
  color: var(--pn-muted);
  font-size: 10px;
  margin-top: 2px;
}

.wf-nodes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.wf-node {
  min-height: 92px;
  border: 1px solid var(--pn-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--pn-bg) 74%, transparent);
  padding: 10px;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.wf-node.is-active {
  transform: translateY(-2px);
  border-color: rgb(var(--pn-accent-rgb) / 0.38);
  background: rgb(var(--pn-accent-rgb) / 0.1);
}

.wf-node.is-done {
  border-color: rgb(var(--pn-blue-rgb) / 0.22);
}

.wf-node span {
  width: 26px;
  height: 26px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: rgb(var(--pn-accent-rgb) / 0.12);
  color: var(--pn-fg);
  font-size: 12px;
  font-weight: 760;
}

.wf-node strong {
  display: block;
  margin-top: 8px;
  color: var(--pn-fg);
  font-size: 13px;
}

.wf-node em {
  display: block;
  margin-top: 5px;
  color: var(--pn-muted);
  font-size: 11px;
  font-style: normal;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.wf-bottom {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 10px;
  margin-top: 10px;
}

.wf-status,
.wf-artifacts {
  border: 1px solid var(--pn-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--pn-bg) 70%, transparent);
  padding: 12px;
}

.wf-status-kicker {
  color: var(--pn-muted);
  font-size: 11px;
  margin-bottom: 5px;
}

.wf-status-title {
  color: var(--pn-fg);
  font-weight: 760;
  margin-bottom: 10px;
}

.wf-cli-meter {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 24px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--pn-border) 82%, transparent);
  background: color-mix(in srgb, var(--pn-fg) 3%, transparent);
  padding: 5px 8px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.wf-cli-label {
  color: rgb(var(--pn-accent-rgb));
  font-size: 11px;
  white-space: nowrap;
}

.wf-cli-bar {
  min-width: 0;
  color: color-mix(in srgb, rgb(var(--pn-blue-rgb)) 76%, var(--pn-accent));
  font-size: 12px;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
  text-shadow: 0 0 14px rgb(var(--pn-blue-rgb) / 0.22);
}

.wf-cli-value {
  color: var(--pn-muted);
  font-size: 11px;
  text-align: right;
  white-space: nowrap;
}

.wf-file-list {
  height: 110px;
  overflow-y: auto;
  display: grid;
  align-content: start;
  gap: 2px;
  padding: 2px 8px 2px 0;
  scroll-behavior: smooth;
}

.wf-file-list::-webkit-scrollbar {
  width: 7px;
}

.wf-file-list::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--pn-fg) 4%, transparent);
  border-radius: 999px;
}

.wf-file-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgb(var(--pn-accent-rgb) / 0.48), rgb(var(--pn-blue-rgb) / 0.5));
  border-radius: 999px;
}

.wf-file-row {
  min-height: 22px;
  padding: 2px 0;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 220ms ease, transform 220ms ease;
}

.wf-file-row.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.wf-file-name {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: color-mix(in srgb, var(--pn-fg) 76%, rgb(var(--pn-blue-rgb)));
  font-size: 12px;
  font-weight: 560;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.wf-file-name::before {
  content: './';
  color: rgb(var(--pn-accent-rgb));
  opacity: 0.72;
}

@media (max-width: 980px) {
  .wf-nodes {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .wf-bottom {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .lp2-section {
    padding: 44px 0;
  }
  .lp2-container {
    padding: 0 12px;
  }
  .wf-shell {
    padding: 12px;
  }
  .wf-link {
    min-width: 0;
    width: 100%;
  }
  .wf-cron {
    width: 100%;
    margin-left: 0;
  }
  .wf-pipeline {
    padding: 12px;
  }
  .wf-rail {
    margin: 0 10px 8px;
  }
  .wf-task {
    width: 104px;
    max-width: 104px;
  }
  .wf-nodes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .wf-node {
    min-height: 84px;
  }
}
</style>
