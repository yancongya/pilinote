<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { prefersReducedMotion } from '../../../lib/motion'

type Tab = { id: string; label: string; asset: string; desc: string }

const tabs: Tab[] = [
  { id: 'library', label: '媒体库/下载列表', asset: '/landing/mock-library.svg', desc: '批量同步、下载状态、本地媒体统一展示。' },
  { id: 'detail', label: '视频详情/AI 笔记', asset: '/landing/mock-detail.svg', desc: 'AI 笔记、章节、关键点和时间戳回跳集中在详情页。' },
  { id: 'settings', label: '设置/AI 配置', asset: '/landing/mock-settings.svg', desc: '下载目录、模型、提示词和自动化策略集中配置。' },
]

const active = ref<Tab['id']>('detail')
const shotRef = ref<HTMLElement | null>(null)
const mediaRef = ref<HTMLElement | null>(null)
const addressRef = ref<HTMLElement | null>(null)
let autoTimer: ReturnType<typeof setInterval> | undefined
let resumeTimer: ReturnType<typeof setTimeout> | undefined

const current = computed(() => tabs.find((t) => t.id === active.value) ?? tabs[0])
const title = computed(() => current.value.label)
const locationText = computed(() => `pilinote://${current.value.id}`)
const animatedLocationText = ref(locationText.value)
let typeTimer: ReturnType<typeof setInterval> | undefined

function clearAutoTimer() {
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = undefined
  }
}

function startAutoTimer() {
  clearAutoTimer()
  autoTimer = setInterval(() => {
    const idx = tabs.findIndex((t) => t.id === active.value)
    const next = (idx + 1) % tabs.length
    active.value = tabs[next]?.id ?? tabs[0].id
  }, 5400)
}

function clearTypeTimer() {
  if (typeTimer) {
    clearInterval(typeTimer)
    typeTimer = undefined
  }
}

function runTypewriter(nextText: string) {
  clearTypeTimer()
  animatedLocationText.value = ''
  let cursor = 0
  typeTimer = setInterval(() => {
    cursor += 1
    animatedLocationText.value = nextText.slice(0, cursor)
    if (cursor >= nextText.length) {
      clearTypeTimer()
    }
  }, 22)
}

function setActive(id: Tab['id']) {
  if (id === active.value) return
  active.value = id
  clearAutoTimer()
  if (resumeTimer) clearTimeout(resumeTimer)
  resumeTimer = setTimeout(() => {
    startAutoTimer()
  }, 6000)
}

watch(
  () => current.value.id,
  async (nextId) => {
  if (!shotRef.value) return
  const nextLocationText = `pilinote://${nextId}`
  if (prefersReducedMotion()) {
    animatedLocationText.value = nextLocationText
  } else {
    runTypewriter(nextLocationText)
  }
  const { gsap } = await import('gsap')
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
  tl.fromTo(shotRef.value, { autoAlpha: 0.7 }, { autoAlpha: 1, duration: 0.44 }, 0)
  if (mediaRef.value) {
    tl.fromTo(mediaRef.value, { autoAlpha: 0.9 }, { autoAlpha: 1, duration: 0.42 }, 0.04)
  }
  if (addressRef.value) {
    tl.fromTo(addressRef.value, { autoAlpha: 0.24, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.42 }, 0.12)
  }
  },
  { immediate: true }
)

watch(locationText, (next) => {
  if (prefersReducedMotion()) {
    animatedLocationText.value = next
  }
})

onMounted(() => {
  tabs.forEach((tab) => {
    const img = new Image()
    img.src = withBase(tab.asset)
  })
  animatedLocationText.value = locationText.value
  startAutoTimer()
})

onBeforeUnmount(() => {
  clearAutoTimer()
  clearTypeTimer()
  if (resumeTimer) clearTimeout(resumeTimer)
})
</script>

<template>
  <section id="gallery" class="lp2-section" data-reveal>
    <div class="lp2-container">
      <div class="lp2-section-head">
        <h2 class="lp2-h2">截图与演示</h2>
        <p class="lp2-sub">
          三个核心界面连起来：从批量同步下载，到 AI 笔记回跳，再到长期配置与管理。
        </p>
      </div>

      <div class="lp2-gallery2">
        <div
          :id="`gallery-panel-${current.id}`"
          ref="shotRef"
          class="lp2-shot2"
          role="tabpanel"
          :aria-label="title"
        >
          <div class="lp2-shot2-top">
            <div class="lp2-shot2-tabs" role="tablist" aria-label="Gallery tabs">
              <button
                v-for="t in tabs"
                :key="t.id"
                class="lp2-tab"
                type="button"
                role="tab"
                :aria-selected="active === t.id"
                :aria-controls="`gallery-panel-${t.id}`"
                :class="{ 'is-active': active === t.id }"
                @click="setActive(t.id)"
              >
                {{ t.label }}
              </button>
            </div>
            <div class="lp2-shot-controls" aria-hidden="true">
              <span class="dot dot-red" />
              <span class="dot dot-yellow" />
              <span class="dot dot-green" />
            </div>
            <div ref="addressRef" class="lp2-address">{{ animatedLocationText }}</div>
            <div class="lp2-shot-inline-caption">{{ current.desc }}</div>
          </div>

          <div ref="mediaRef" class="lp2-shot-media">
            <img class="lp2-shot-img" :src="withBase(current.asset)" :alt="`${title} 界面示意`" />
          </div>
        </div>

      </div>
    </div>
  </section>
</template>

<style scoped>
.lp2-section {
  padding: 46px 0;
}

.lp2-container {
  max-width: 1200px;
  padding: 0 18px;
  margin: 0 auto;
}

.lp2-section-head {
  margin-bottom: 12px;
}

.lp2-h2 {
  margin: 0 0 6px 0;
  font-size: 20px;
  line-height: 1.25;
}

.lp2-sub {
  margin: 0;
  color: var(--pn-muted);
  line-height: 1.5;
  font-size: 13px;
  max-width: 70ch;
}

.lp2-gallery2 {
  max-width: 1100px;
  margin: 0 auto;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--pn-border) 86%, transparent);
  background: transparent;
  padding: 0;
}

.lp2-tab {
  height: 32px;
  padding: 0 11px;
  border-radius: 11px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 72%, transparent);
  color: var(--pn-muted);
  font-size: 13px;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.lp2-tab:hover {
  transform: translateY(-1px);
  background: var(--pn-card-2);
  border-color: rgb(var(--pn-accent-rgb) / 0.28);
}
.lp2-tab.is-active {
  background: linear-gradient(90deg, rgb(var(--pn-accent-rgb) / 0.18), rgb(var(--pn-blue-rgb) / 0.16));
  border-color: rgb(var(--pn-accent-rgb) / 0.26);
  color: var(--pn-fg);
}

.lp2-shot2 {
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 82%, transparent);
  overflow: hidden;
  padding: 0 0 6px;
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
  will-change: transform, opacity, box-shadow;
}
.lp2-shot2:hover {
  transform: translateY(-2px) scale(1.002);
  border-color: rgb(var(--pn-accent-rgb) / 0.28);
  box-shadow: 0 22px 54px rgb(2 6 23 / 0.18);
}

.lp2-shot2-top {
  min-height: 60px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--pn-border);
  background:
    radial-gradient(460px 120px at 8% 0%, rgb(var(--pn-accent-rgb) / 0.1), transparent 76%),
    linear-gradient(180deg, color-mix(in srgb, var(--pn-card) 72%, transparent), color-mix(in srgb, var(--pn-bg) 84%, transparent));
}

.lp2-shot2-tabs {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.lp2-shot-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.dot-red {
  background: #ff6057;
}

.dot-yellow {
  background: #ffbd2e;
}

.dot-green {
  background: #28c840;
}

.lp2-address {
  flex: 1;
  min-width: 0;
  height: 26px;
  border-radius: 999px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 76%, transparent);
  color: var(--pn-muted);
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.lp2-shot-inline-caption {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--pn-muted);
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lp2-shot-media {
  width: 100%;
  position: relative;
  border-radius: 12px;
  border: 1px solid var(--pn-border);
  overflow: hidden;
  aspect-ratio: 16 / 8.2;
  background: var(--pn-app-panel);
  margin: 6px 8px 4px;
}

.lp2-shot-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  background: var(--pn-app-panel);
}

@media (min-width: 860px) {
  .lp2-h2 {
    font-size: 22px;
  }
}

@media (max-width: 860px) {
  .lp2-shot2-top {
    min-height: 62px;
  }
  .lp2-shot2-tabs {
    gap: 8px;
  }
  .lp2-tab {
    height: 30px;
    font-size: 12px;
  }
}

@media (max-width: 680px) {
  .lp2-section {
    padding: 36px 0;
  }
  .lp2-container {
    padding: 0 12px;
  }
  .lp2-gallery2 {
    padding: 0;
  }
  .lp2-shot2-top {
    gap: 8px;
    padding: 7px 8px;
  }
  .lp2-shot2-tabs {
    gap: 6px;
  }
  .lp2-tab {
    padding: 0 9px;
  }
  .lp2-address {
    font-size: 11px;
    padding: 0 10px;
  }
  .lp2-shot-inline-caption {
    font-size: 10px;
  }
  .lp2-shot-media {
    margin: 6px 6px 4px;
  }
}
</style>
