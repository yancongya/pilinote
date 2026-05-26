<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { prefersReducedMotion } from '../../../lib/motion'

const rootRef = ref<HTMLElement | null>(null)
let cleanup: (() => void) | undefined

const notes = [
  { time: '03:24', title: '为什么收藏夹会失控', desc: '内容越堆越多，真正想复习时很难定位重点。' },
  { time: '08:16', title: '把视频落成本地资产', desc: '视频、字幕、NFO、截图和 AI 笔记同级归档。' },
  { time: '14:42', title: '点击时间戳回到片段', desc: '从笔记直接跳回视频进度，复盘不再重新拖进度条。' },
]

const processSteps = [
  '获取视频源',
  '下载视频',
  '下载字幕',
  '获取评论区信息',
  '获取简介信息',
  '生成 NFO 信息',
  '构建 Prompt',
  '进行 AI 分析',
]

const currentProcess = ref(processSteps[0])
const processBlockCount = ref(2)
const processTick = ref(0)
const activeNoteIndex = ref(1)
const notesReady = ref(false)
const isPlaying = ref(false)
const playheadPercent = ref(0.32)
let demoTl: import('gsap').GSAPTimeline | undefined

async function setupMotion() {
  if (!rootRef.value || prefersReducedMotion()) return

  const { gsap } = await import('gsap')
  const root = rootRef.value
  const playhead = root.querySelector('[data-playhead]') as HTMLElement | null
  const progress = root.querySelector('[data-progress]') as HTMLElement | null
  if (!playhead || !progress) return
  const replayTargets = Array.from(root.querySelectorAll<HTMLElement>('[data-replay-jump]'))

  gsap.set(root.querySelectorAll('[data-chip]'), { autoAlpha: 0, y: 10, scale: 0.96 })
  gsap.set(root.querySelectorAll('[data-note-line]'), { autoAlpha: 0, y: 8 })
  gsap.set(playhead, { left: '32%', xPercent: -50, x: 0 })
  gsap.set(progress, { scaleX: playheadPercent.value, transformOrigin: 'left center' })

  const tl = gsap.timeline({
    paused: true,
    defaults: { duration: 0.48, ease: 'power2.out' },
    onStart: () => {
      isPlaying.value = true
      notesReady.value = false
    },
    onComplete: () => {
      isPlaying.value = false
      notesReady.value = true
      playheadPercent.value = 0.78
    },
  })

  processSteps.forEach((step, index) => {
    tl.call(() => {
      currentProcess.value = step
      processTick.value += 1
      processBlockCount.value = index === 1 || index === 7 ? 1 : 3
    })
    if (index === 1 || index === 7) {
      const state = { blocks: 1 }
      tl.to(state, {
        blocks: 12,
        duration: 0.58,
        ease: 'steps(11)',
        onUpdate: () => {
          processBlockCount.value = Math.max(1, Math.round(state.blocks))
        },
      })
    } else {
      tl.to({}, { duration: 0.28 })
    }
  })
  tl
    .to(root.querySelectorAll('[data-chip]'), { autoAlpha: 1, y: 0, scale: 1, stagger: 0.1 }, '<0.12')
    .to(root.querySelectorAll('[data-note-line]'), { autoAlpha: 1, y: 0, stagger: 0.12 }, '-=0.08')
    .to(playhead, { left: '78%', duration: 0.78, ease: 'power3.inOut' }, '<0.02')
    .to(progress, { scaleX: 0.78, duration: 0.78, ease: 'power3.inOut' }, '<')
    .call(() => {
      currentProcess.value = 'AI 笔记已生成'
      processBlockCount.value = 12
      activeNoteIndex.value = 1
      playheadPercent.value = 0.78
    })

  demoTl = tl
  const replay = () => {
    currentProcess.value = processSteps[0]
    processBlockCount.value = 2
    processTick.value += 1
    activeNoteIndex.value = 1
    playheadPercent.value = 0.32
    gsap.set(playhead, { left: '32%', xPercent: -50, x: 0 })
    gsap.set(progress, { scaleX: 0.32, transformOrigin: 'left center' })
    tl.restart()
  }
  replayTargets.forEach((target) => target.addEventListener('click', replay))

  // autoplay only once on first mount
  replay()

  cleanup = () => {
    replayTargets.forEach((target) => target.removeEventListener('click', replay))
    tl.kill()
  }
}

async function jumpToNote(index: number) {
  if (!notesReady.value || isPlaying.value || !rootRef.value) return
  const { gsap } = await import('gsap')
  const playhead = rootRef.value.querySelector('[data-playhead]') as HTMLElement | null
  const progress = rootRef.value.querySelector('[data-progress]') as HTMLElement | null
  if (!playhead || !progress) return

  const targets = [0.32, 0.55, 0.78]
  const next = targets[index] ?? 0.32
  activeNoteIndex.value = index
  playheadPercent.value = next
  gsap.to(progress, { scaleX: next, duration: 0.44, ease: 'power2.inOut', transformOrigin: 'left center' })
  gsap.to(playhead, { left: `${Math.round(next * 100)}%`, duration: 0.44, ease: 'power2.inOut' })
}

onMounted(() => {
  void setupMotion()
})

onBeforeUnmount(() => {
  demoTl?.kill()
  cleanup?.()
})
</script>

<template>
  <div ref="rootRef" class="demo-stage" aria-label="PiliNote AI 笔记回跳产品演示">
    <div class="demo-orbit demo-orbit-left" data-chip>来自收藏夹 · 已同步</div>
    <div class="demo-orbit demo-orbit-right" data-chip>生成 .ai-note.md</div>
    <div class="demo-orbit demo-orbit-bottom" data-chip>时间戳可回跳</div>

    <div class="demo-window">
      <div class="demo-chrome">
        <span class="demo-dot" />
        <span class="demo-dot" />
        <span class="demo-dot" />
        <span class="demo-title">PiliNote / 视频详情</span>
      </div>

      <div class="demo-screen">
        <section class="demo-video">
          <div class="demo-video-art">
            <div class="demo-video-badge">Bilibili 收藏夹</div>
            <button class="demo-play-button" type="button" aria-label="播放演示" data-replay-jump />
            <div class="demo-video-copy">
              <strong>LLM 笔记工作流实战</strong>
              <span>已下载到本地知识库</span>
            </div>
          </div>

          <div class="demo-timeline">
            <div class="demo-track">
              <span class="demo-progress" data-progress />
              <span class="demo-playhead" data-playhead />
            </div>
            <div class="demo-time">
              <span>03:24</span>
              <span>14:42</span>
            </div>
          </div>

          <div class="demo-process" aria-label="处理流程">
            <div :key="processTick" class="demo-process-line">&gt; {{ currentProcess }} ...</div>
            <div class="demo-process-meter" aria-hidden="true">
              <span v-for="n in 12" :key="n" :class="{ 'is-filled': n <= processBlockCount }" />
            </div>
          </div>
        </section>

        <section class="demo-notes">
          <div class="demo-notes-head">
            <div>
              <span>AI Note</span>
              <h3>这条视频讲了什么</h3>
            </div>
            <button class="demo-mini-btn" type="button" data-replay-jump>重播回跳</button>
          </div>

          <button
            v-for="(note, index) in notes"
            :key="note.time"
            class="demo-note"
            :class="{ 'is-primary': index === activeNoteIndex }"
            :data-note-line="true"
            type="button"
            @click="void jumpToNote(index)"
          >
            <span>{{ note.time }}</span>
            <div>
              <strong>{{ note.title }}</strong>
              <p>{{ note.desc }}</p>
            </div>
          </button>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-stage {
  position: relative;
  min-height: 390px;
  display: grid;
  align-items: center;
  isolation: isolate;
}

.demo-stage::before {
  content: '';
  position: absolute;
  inset: 4% 5% 0;
  z-index: -1;
  border-radius: 36px;
  background:
    radial-gradient(560px 280px at 26% 12%, rgb(var(--pn-accent-rgb) / 0.2), transparent 62%),
    radial-gradient(520px 280px at 86% 18%, rgb(var(--pn-blue-rgb) / 0.16), transparent 62%);
  filter: blur(2px);
}

.demo-window {
  border: 1px solid var(--pn-border);
  border-radius: 26px;
  background: var(--pn-app-bg);
  box-shadow: var(--pn-app-shadow);
  overflow: hidden;
  transform: translateZ(0);
}

.demo-chrome {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-bottom: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-app-bg) 78%, transparent);
}

.demo-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pn-fg) 18%, transparent);
}

.demo-title {
  margin-left: 8px;
  color: var(--pn-muted);
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-screen {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(260px, 0.88fr);
  gap: 10px;
  padding: 10px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--pn-app-panel) 58%, transparent), transparent),
    var(--pn-app-bg);
}

.demo-video,
.demo-notes {
  border: 1px solid var(--pn-border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--pn-app-panel) 82%, transparent);
  box-shadow: var(--pn-soft-shadow);
}

.demo-video {
  padding: 10px;
}

.demo-video-art {
  min-height: 210px;
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  background:
    radial-gradient(420px 220px at 24% 18%, rgb(var(--pn-accent-rgb) / 0.28), transparent 60%),
    radial-gradient(400px 220px at 82% 26%, rgb(var(--pn-blue-rgb) / 0.24), transparent 62%),
    linear-gradient(135deg, #141827, #070a12);
}

.demo-video-art::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: linear-gradient(to bottom, black, transparent 86%);
  pointer-events: none;
}

.demo-video-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 1;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
  padding: 5px 9px;
}

.demo-play-button {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 54px;
  height: 54px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(10px);
  z-index: 2;
  cursor: pointer;
}

.demo-play-button::after {
  content: '';
  position: absolute;
  left: 22px;
  top: 17px;
  border-left: 16px solid white;
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
}

.demo-video-copy {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  z-index: 1;
  display: grid;
  gap: 4px;
  color: white;
}

.demo-video-copy strong {
  font-size: 15px;
}

.demo-video-copy span {
  color: rgba(255, 255, 255, 0.66);
  font-size: 13px;
}

.demo-timeline {
  padding: 10px 2px 0;
}

.demo-track {
  height: 10px;
  position: relative;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pn-fg) 10%, transparent);
}

.demo-progress {
  position: absolute;
  inset: 0;
  width: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgb(var(--pn-accent-rgb)), rgb(var(--pn-blue-rgb)));
}

.demo-playhead {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18px;
  height: 18px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: white;
  border: 4px solid rgb(var(--pn-accent-rgb));
  box-shadow: 0 0 0 6px rgb(var(--pn-accent-rgb) / 0.12);
}

.demo-time {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--pn-muted);
  font-size: 12px;
}

.demo-process {
  height: 32px;
  margin-top: 8px;
  border: 1px solid var(--pn-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--pn-fg) 4%, transparent);
  color: var(--pn-muted);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  padding: 0 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.demo-process-line {
  display: flex;
  align-items: center;
  color: var(--pn-muted);
  font-size: 12px;
  line-height: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  will-change: transform, opacity;
  animation: demo-line-in 180ms ease-out;
}

.demo-process-meter {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 3px;
  align-items: center;
}

.demo-process-meter span {
  height: 9px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgb(var(--pn-accent-rgb)), rgb(var(--pn-blue-rgb)));
  opacity: 0.22;
  transition: opacity 120ms ease, transform 120ms ease;
}

.demo-process-meter span.is-filled {
  opacity: 1;
  transform: translateY(-1px);
}

@keyframes demo-line-in {
  from {
    opacity: 0.45;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.demo-notes {
  padding: 10px;
}

.demo-notes-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
  margin-bottom: 8px;
}

.demo-notes-head span {
  color: rgb(var(--pn-accent-rgb));
  font-size: 12px;
  font-weight: 780;
}

.demo-notes-head h3 {
  margin: 3px 0 0;
  color: var(--pn-fg);
  font-size: 15px;
  line-height: 1.25;
}

.demo-mini-btn {
  flex: 0 0 auto;
  height: 30px;
  border-radius: 999px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-app-bg) 74%, transparent);
  color: var(--pn-fg);
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;
}

.demo-note {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  border: 1px solid var(--pn-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--pn-app-bg) 74%, transparent);
  color: inherit;
  text-align: left;
  padding: 9px;
  cursor: pointer;
}

.demo-note + .demo-note {
  margin-top: 7px;
}

.demo-note:hover,
.demo-note:focus-visible,
.demo-note.is-primary {
  border-color: rgb(var(--pn-accent-rgb) / 0.3);
  outline: none;
}

.demo-note span {
  border-radius: 10px;
  background: rgb(var(--pn-accent-rgb) / 0.12);
  color: rgb(var(--pn-accent-rgb));
  font-size: 12px;
  font-weight: 780;
  padding: 4px 6px;
}

.demo-note strong {
  display: block;
  color: var(--pn-fg);
  font-size: 12px;
  margin-bottom: 3px;
}

.demo-note p {
  margin: 0;
  color: var(--pn-muted);
  font-size: 11.5px;
  line-height: 1.45;
}

.demo-orbit {
  position: absolute;
  z-index: 2;
  border: 1px solid var(--pn-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--pn-app-bg) 82%, transparent);
  box-shadow: var(--pn-soft-shadow);
  color: var(--pn-muted);
  font-size: 12px;
  padding: 6px 9px;
  backdrop-filter: blur(10px);
}

.demo-orbit-left {
  left: -8px;
  top: 64px;
}

.demo-orbit-right {
  right: -8px;
  top: 96px;
}

.demo-orbit-bottom {
  left: 28%;
  bottom: 12px;
}

@media (max-width: 1120px) {
  .demo-screen {
    grid-template-columns: 1fr;
  }

  .demo-video-art {
    min-height: 220px;
  }
}

@media (max-width: 680px) {
  .demo-stage {
    min-height: 0;
  }

  .demo-screen {
    padding: 8px;
    gap: 8px;
  }

  .demo-video,
  .demo-notes {
    border-radius: 14px;
    padding: 8px;
  }

  .demo-video-art {
    min-height: 150px;
  }

  .demo-chrome {
    height: 32px;
  }

  .demo-title,
  .demo-video-badge,
  .demo-video-copy span,
  .demo-time,
  .demo-notes-head span,
  .demo-mini-btn,
  .demo-note span,
  .demo-note p,
  .demo-flow-node {
    font-size: 10.5px;
  }

  .demo-flow {
    gap: 3px;
  }

  .demo-flow-node {
    padding: 2px 5px 2px 4px;
  }

  .demo-flow-node i {
    width: 6px;
    height: 6px;
  }

  .demo-video-copy strong {
    font-size: 13px;
  }

  .demo-notes-head h3 {
    font-size: 13px;
  }

  .demo-note {
    grid-template-columns: 42px 1fr;
  }

  .demo-orbit {
    display: none;
  }
}
</style>
