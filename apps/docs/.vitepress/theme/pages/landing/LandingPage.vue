<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { prefersReducedMotion, useReducedMotionGuard } from '../../lib/motion'
import LandingTopbar from './components/LandingTopbar.vue'
import HeroSection from './components/HeroSection.vue'
import DownloadSection from './components/DownloadSection.vue'
import WhySection from './components/WhySection.vue'
import WorkflowSection from './components/WorkflowSection.vue'
import FeaturesSection from './components/FeaturesSection.vue'
import GallerySection from './components/GallerySection.vue'
import FaqSection from './components/FaqSection.vue'
import LandingFooter from './components/LandingFooter.vue'

const rootRef = ref<HTMLElement | null>(null)
const active = ref<string>('product')
const docCardRefs = ref<Array<HTMLElement | null>>([])
let gsapCache: (typeof import('gsap'))['gsap'] | undefined

function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function computeActive() {
  const ids = ['product', 'why', 'workflow', 'features', 'gallery', 'faq', 'docs', 'download']
  const top = window.scrollY
  const height = window.innerHeight
  const probe = top + Math.min(140, height * 0.2)

  let best = ids[0]
  let bestDist = Number.POSITIVE_INFINITY

  for (const id of ids) {
    const el = document.getElementById(id)
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const y = rect.top + top
    const dist = Math.abs(y - probe)
    if (dist < bestDist) {
      bestDist = dist
      best = id
    }
  }

  active.value = best
}

function setDocCardRef(el: Element | null, index: number) {
  docCardRefs.value[index] = el as HTMLElement | null
}

async function getGsap() {
  if (gsapCache) return gsapCache
  const { gsap } = await import('gsap')
  gsapCache = gsap
  return gsap
}

async function onDocCardEnter(index: number) {
  if (prefersReducedMotion()) return
  const gsap = await getGsap()
  docCardRefs.value.forEach((el, i) => {
    if (!el) return
    if (i === index) {
      gsap.to(el, { y: -3, opacity: 1, duration: 0.2, ease: 'power2.out' })
    } else {
      gsap.to(el, { y: 0, opacity: 0.78, duration: 0.2, ease: 'power2.out' })
    }
  })
}

async function onDocCardLeave() {
  if (prefersReducedMotion()) return
  const gsap = await getGsap()
  docCardRefs.value.forEach((el) => {
    if (!el) return
    gsap.to(el, { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out' })
  })
}

async function onDocCardPress(index: number, down: boolean) {
  if (prefersReducedMotion()) return
  const el = docCardRefs.value[index]
  if (!el) return
  const gsap = await getGsap()
  gsap.to(el, { scale: down ? 0.988 : 1, duration: down ? 0.08 : 0.16, ease: 'power2.out' })
}

useReducedMotionGuard(async () => {
  const { gsap } = await import('gsap')
  const { ScrollTrigger } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ScrollTrigger)

  const ctx = gsap.context(() => {
    if (!rootRef.value) return

    // Hero entrance
    const heroTargets = rootRef.value.querySelectorAll('[data-hero]')
    gsap.fromTo(
      heroTargets,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.42, ease: 'power2.out', stagger: 0.045 }
    )

    // Section reveals (lightweight)
    const blocks = rootRef.value.querySelectorAll('[data-reveal]')
    for (const b of Array.from(blocks)) {
      gsap.fromTo(
        b,
        { y: 10, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.36,
          ease: 'power2.out',
          scrollTrigger: { trigger: b as Element, start: 'top 78%' },
        }
      )
    }
  })

  return () => ctx.revert()
})

onMounted(() => {
  computeActive()
  window.addEventListener('scroll', computeActive, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', computeActive)
})
</script>

<template>
  <div ref="rootRef" class="lp2">
    <LandingTopbar :active="active" @nav="scrollToId" />

    <main class="lp2-main">
      <HeroSection />
      <WhySection />
      <WorkflowSection />
      <FeaturesSection />
      <GallerySection />
      <FaqSection />
      <section id="docs" class="lp2-section lp2-section-compact" data-reveal>
        <div class="lp2-container">
          <div class="lp2-section-head">
            <h2 class="lp2-h2">文档入口</h2>
            <p class="lp2-sub">
              想二开/调试/查接口：直接去开发文档；想上手：去使用指南。
            </p>
          </div>

          <div class="lp2-docs-grid">
            <a
              class="lp2-doc-card"
              :href="withBase('/dev/')"
              :ref="el => setDocCardRef(el, 0)"
              @mouseenter="void onDocCardEnter(0)"
              @mouseleave="void onDocCardLeave()"
              @mousedown="void onDocCardPress(0, true)"
              @mouseup="void onDocCardPress(0, false)"
            >
              <div class="lp2-doc-title">开发文档</div>
              <div class="lp2-doc-desc">架构、模块、API、组件与实现细节</div>
            </a>
            <a
              class="lp2-doc-card"
              :href="withBase('/guide/')"
              :ref="el => setDocCardRef(el, 1)"
              @mouseenter="void onDocCardEnter(1)"
              @mouseleave="void onDocCardLeave()"
              @mousedown="void onDocCardPress(1, true)"
              @mouseup="void onDocCardPress(1, false)"
            >
              <div class="lp2-doc-title">使用指南</div>
              <div class="lp2-doc-desc">上手、常见问题与工作流说明</div>
            </a>
          </div>
        </div>
      </section>
      <DownloadSection />
    </main>

    <LandingFooter />
  </div>
</template>

<style scoped>
.lp2 {
  color: var(--pn-fg);
  background: var(--pn-bg);
  min-height: 100vh;
  position: relative;
  isolation: isolate;
}

.lp2-main {
  padding-bottom: 72px;
}

.lp2::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(color-mix(in srgb, var(--pn-fg) 3%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--pn-fg) 3%, transparent) 1px, transparent 1px),
    radial-gradient(1200px 700px at 20% -10%, rgb(var(--pn-accent-rgb) / 0.18), transparent 55%),
    radial-gradient(900px 520px at 90% 10%, rgb(var(--pn-accent2-rgb) / 0.12), transparent 55%),
    radial-gradient(700px 420px at 60% 110%, rgb(var(--pn-accent-rgb) / 0.06), transparent 55%);
  background-size: 24px 24px, 24px 24px, auto, auto, auto;
  background-position: 0 0, 0 0, 0 0, 0 0, 0 0;
  opacity: 1;
  z-index: -1;
}

.lp2-container {
  max-width: 1200px;
  padding: 0 18px;
  margin: 0 auto;
}

.lp2-section {
  padding: 64px 0;
}

.lp2-section-compact {
  padding: 54px 0;
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
  max-width: 70ch;
}

.lp2-docs-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.lp2-doc-card {
  display: block;
  text-decoration: none;
  color: inherit;
  border-radius: 14px;
  border: 1px solid var(--pn-border);
  background: var(--pn-card);
  padding: 16px;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
}
.lp2-doc-card:hover {
  transform: translateY(-2px);
  background: var(--pn-card-2);
  border-color: rgb(var(--pn-accent-rgb) / 0.28);
}

.lp2-doc-title {
  font-weight: 700;
  margin-bottom: 6px;
}
.lp2-doc-desc {
  color: var(--pn-muted);
  line-height: 1.6;
  font-size: 14px;
}

@media (min-width: 860px) {
  .lp2-docs-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .lp2-h2 {
    font-size: 24px;
  }
}
</style>
