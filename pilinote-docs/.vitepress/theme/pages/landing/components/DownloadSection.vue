<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { prefersReducedMotion } from '../../../lib/motion'

const githubDownloadUrl = 'https://github.com/yancongya/pilinote/releases'
const netdiskDownloadUrl = 'https://pan.baidu.com/'

const downloads = [
  {
    title: 'macOS',
    meta: 'Apple Silicon / Intel',
    state: '即将提供',
  },
  {
    title: 'Windows',
    meta: 'Windows 10+',
    state: '规划中',
  },
  {
    title: '源码运行',
    meta: '适合二开和调试',
    state: '查看文档',
    href: '/dev/',
  },
]

const ctaRef = ref<HTMLElement | null>(null)
const actionRefs = ref<Array<HTMLElement | null>>([])
const cardRefs = ref<Array<HTMLElement | null>>([])
let pulseTimer: ReturnType<typeof setInterval> | undefined
let gsapCache: (typeof import('gsap'))['gsap'] | undefined

function setActionRef(el: Element | null, index: number) {
  actionRefs.value[index] = el as HTMLElement | null
}

function setCardRef(el: Element | null, index: number) {
  cardRefs.value[index] = el as HTMLElement | null
}

async function getGsap() {
  if (gsapCache) return gsapCache
  const { gsap } = await import('gsap')
  gsapCache = gsap
  return gsap
}

async function pulseTargets() {
  if (prefersReducedMotion()) return
  const gsap = await getGsap()
  const targetA = actionRefs.value[0]
  const targetB = cardRefs.value[2]
  if (targetA) {
    gsap.fromTo(targetA, { scale: 1 }, { scale: 1.03, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.inOut' })
  }
  if (targetB) {
    gsap.fromTo(
      targetB,
      { borderColor: 'rgb(var(--pn-border))' },
      {
        borderColor: 'rgb(var(--pn-accent-rgb) / 0.35)',
        duration: 0.24,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
      }
    )
  }
}

async function onActionHover(index: number, enter: boolean) {
  if (prefersReducedMotion()) return
  const el = actionRefs.value[index]
  if (!el) return
  const gsap = await getGsap()
  gsap.to(el, { y: enter ? -2 : 0, duration: 0.18, ease: 'power2.out' })
}

async function onActionPress(index: number, down: boolean) {
  if (prefersReducedMotion()) return
  const el = actionRefs.value[index]
  if (!el) return
  const gsap = await getGsap()
  gsap.to(el, { scale: down ? 0.985 : 1, duration: down ? 0.08 : 0.16, ease: 'power2.out' })
}

async function onCardHover(index: number, enter: boolean) {
  if (prefersReducedMotion()) return
  const el = cardRefs.value[index]
  if (!el) return
  const gsap = await getGsap()
  gsap.to(el, { y: enter ? -2 : 0, duration: 0.2, ease: 'power2.out' })
}

async function onCtaMove(event: MouseEvent) {
  if (prefersReducedMotion()) return
  if (!ctaRef.value) return
  const rect = ctaRef.value.getBoundingClientRect()
  const dx = (event.clientX - rect.left - rect.width / 2) / rect.width
  const dy = (event.clientY - rect.top - rect.height / 2) / rect.height
  const gsap = await getGsap()
  gsap.to(ctaRef.value, { '--dlx': `${dx * 8}px`, '--dly': `${dy * 7}px`, duration: 0.24, ease: 'power2.out' })
}

async function onCtaLeave() {
  if (prefersReducedMotion()) return
  if (!ctaRef.value) return
  const gsap = await getGsap()
  gsap.to(ctaRef.value, { '--dlx': '0px', '--dly': '0px', duration: 0.28, ease: 'power2.out' })
}

onMounted(() => {
  pulseTimer = setInterval(() => {
    void pulseTargets()
  }, 3200)
})

onBeforeUnmount(() => {
  if (pulseTimer) clearInterval(pulseTimer)
})
</script>

<template>
  <section id="download" class="lp2-section lp2-section-compact" data-reveal>
    <div class="lp2-container">
      <div ref="ctaRef" class="lp2-download-cta" @mousemove="void onCtaMove($event)" @mouseleave="void onCtaLeave()">
        <div class="lp2-download-copy">
          <div class="lp2-kicker">Download</div>
          <h2 class="lp2-h2">准备把收藏夹落成本地知识库了吗？</h2>
          <p class="lp2-sub">
            正式版本会优先通过 GitHub Release 和网盘分发，源码和文档仍可用于二开与调试。
          </p>
          <div class="lp2-actions">
            <a
              class="lp2-btn lp2-btn-primary"
              :href="githubDownloadUrl"
              target="_blank"
              rel="noreferrer"
              :ref="el => setActionRef(el, 0)"
              @mouseenter="void onActionHover(0, true)"
              @mouseleave="void onActionHover(0, false)"
              @mousedown="void onActionPress(0, true)"
              @mouseup="void onActionPress(0, false)"
            >
              GitHub 下载
            </a>
            <a
              class="lp2-btn"
              :href="netdiskDownloadUrl"
              target="_blank"
              rel="noreferrer"
              :ref="el => setActionRef(el, 1)"
              @mouseenter="void onActionHover(1, true)"
              @mouseleave="void onActionHover(1, false)"
              @mousedown="void onActionPress(1, true)"
              @mouseup="void onActionPress(1, false)"
            >
              网盘下载
            </a>
          </div>
        </div>

        <div class="lp2-download-grid" aria-label="下载选项">
          <a
            v-for="(item, index) in downloads"
            :key="item.title"
            class="lp2-dl-card"
            :href="item.href ? withBase(item.href) : undefined"
            :aria-disabled="item.href ? undefined : 'true'"
            :ref="el => setCardRef(el, index)"
            @mouseenter="void onCardHover(index, true)"
            @mouseleave="void onCardHover(index, false)"
          >
            <div class="lp2-dl-title">{{ item.title }}</div>
            <div class="lp2-dl-desc">{{ item.meta }}</div>
            <div class="lp2-dl-state">{{ item.state }}</div>
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lp2-section {
  padding: 56px 0 24px;
  scroll-margin-top: 70px;
}

.lp2-section-compact {
  padding-top: 48px;
}

.lp2-container {
  max-width: 1200px;
  padding: 0 18px;
  margin: 0 auto;
}

.lp2-download-cta {
  --dlx: 0px;
  --dly: 0px;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--pn-border);
  border-radius: 22px;
  background:
    radial-gradient(760px 260px at 12% 0%, rgb(var(--pn-accent-rgb) / 0.14), transparent 58%),
    radial-gradient(620px 260px at 88% 10%, rgb(var(--pn-blue-rgb) / 0.12), transparent 60%),
    var(--pn-card);
  padding: 18px;
  display: grid;
  gap: 18px;
}

.lp2-download-cta::after {
  content: '';
  position: absolute;
  inset: -24% -12%;
  background: radial-gradient(400px 160px at 24% 20%, rgb(var(--pn-accent-rgb) / 0.12), transparent 70%);
  transform: translate(var(--dlx), var(--dly));
  pointer-events: none;
}

.lp2-download-copy,
.lp2-download-grid {
  position: relative;
  z-index: 1;
}

.lp2-kicker {
  color: rgb(var(--pn-accent-rgb));
  font-size: 12px;
  font-weight: 780;
  margin-bottom: 6px;
}

.lp2-h2 {
  margin: 0 0 8px;
  font-size: 22px;
  line-height: 1.25;
}

.lp2-sub {
  margin: 0;
  color: var(--pn-muted);
  line-height: 1.6;
  font-size: 14px;
  max-width: 62ch;
}

.lp2-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.lp2-btn {
  height: 38px;
  padding: 0 12px;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 720;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--pn-border);
  color: var(--pn-fg);
  background: color-mix(in srgb, var(--pn-bg) 70%, transparent);
  will-change: transform;
}

.lp2-btn-primary {
  background: rgb(var(--pn-accent-rgb) / 0.18);
  border-color: rgb(var(--pn-accent-rgb) / 0.26);
}

.lp2-download-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.lp2-dl-card {
  display: block;
  text-decoration: none;
  color: inherit;
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 68%, transparent);
  padding: 14px;
  transition: transform 200ms ease, border-color 200ms ease, background 200ms ease;
  will-change: transform;
}

.lp2-dl-card[aria-disabled='true'] {
  cursor: default;
}

.lp2-dl-title {
  font-weight: 780;
  margin-bottom: 4px;
}

.lp2-dl-desc {
  color: var(--pn-muted);
  font-size: 13px;
}

.lp2-dl-state {
  margin-top: 12px;
  display: inline-flex;
  border-radius: 999px;
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.22);
  background: rgb(var(--pn-accent-rgb) / 0.1);
  color: var(--pn-fg);
  font-size: 12px;
  padding: 4px 8px;
}

@media (min-width: 860px) {
  .lp2-download-cta {
    grid-template-columns: 1fr 1.1fr;
    align-items: center;
    padding: 22px;
  }

  .lp2-download-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .lp2-h2 {
    font-size: 24px;
  }
}
</style>
