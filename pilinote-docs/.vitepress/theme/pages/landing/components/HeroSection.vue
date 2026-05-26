<template>
  <section id="product" class="lp2-hero">
    <div class="lp2-container lp2-hero-grid">
      <div class="lp2-hero-copy">
        <div ref="titleWrapRef" class="lp2-h1-row">
          <h1 class="lp2-h1">把B站视频变为本地知识库</h1>
          <svg class="lp2-h1-path" viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true">
            <path
              ref="titlePathRef"
              class="lp2-h1-path-line"
              :d="titlePathD"
            />
          </svg>
        </div>
        <p ref="subtitleRef" class="lp2-subtitle">
          同步收藏夹/稍后再看/历史/订阅文件夹，自动下载落盘，生成可回跳的 AI 笔记。
        </p>

        <div ref="ctaRef" class="lp2-hero-cta">
          <a class="lp2-btn lp2-btn-primary" href="#docs">查看文档</a>
          <a class="lp2-btn" href="#download">开始下载</a>
        </div>
      </div>

      <div ref="visualRef" class="lp2-hero-visual" aria-label="PiliNote 动态流程示意">
        <ProductDemo />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ProductDemo from './ProductDemo.vue'
import { useReducedMotionGuard } from '../../../lib/motion'

const titlePathRef = ref<SVGPathElement | null>(null)
const titleWrapRef = ref<HTMLElement | null>(null)
const subtitleRef = ref<HTMLElement | null>(null)
const ctaRef = ref<HTMLElement | null>(null)
const visualRef = ref<HTMLElement | null>(null)
const titlePathD = ref('M 40 132')

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function buildHandwritePath() {
  const points: Array<{ x: number; y: number }> = []
  const step = 112
  for (let x = 40; x <= 960; x += step) {
    points.push({
      x,
      y: 132 + randomBetween(-46, 44),
    })
  }

  if (points.length < 2) {
    titlePathD.value = 'M 40 132'
    return
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 1; i < points.length; i += 1) {
    const p0 = points[i - 1]
    const p1 = points[i]
    const cp1x = p0.x + step * randomBetween(0.3, 0.62)
    const cp1y = p0.y + randomBetween(-40, 40)
    const cp2x = p1.x - step * randomBetween(0.26, 0.58)
    const cp2y = p1.y + randomBetween(-40, 40)
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
  }
  titlePathD.value = d
}

useReducedMotionGuard(async () => {
  buildHandwritePath()
  const pathEl = titlePathRef.value
  const titleWrap = titleWrapRef.value
  const subtitle = subtitleRef.value
  const cta = ctaRef.value
  const visual = visualRef.value
  if (!pathEl || !titleWrap || !subtitle || !cta || !visual) return
  const { gsap } = await import('gsap')
  const total = pathEl.getTotalLength()

  gsap.set([titleWrap, subtitle, cta, visual], { opacity: 0, y: 12 })
  gsap.set(pathEl, {
    strokeDasharray: total,
    strokeDashoffset: total,
    opacity: 0,
    strokeWidth: 2.4,
  })

  const tl = gsap.timeline()
  tl.to(titleWrap, { opacity: 1, y: 0, duration: 0.58, ease: 'power2.out' })
    .to(subtitle, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '>-0.05')
    .to(cta, { opacity: 1, y: 0, duration: 0.44, ease: 'power2.out' }, '>-0.06')
    .to(visual, { opacity: 1, y: 0, duration: 1.18, ease: 'power2.out' }, '>-0.06')
    .to(
      pathEl,
      {
        opacity: 1,
        keyframes: [
          { strokeDashoffset: total * 0.9, duration: 0.28, ease: 'power1.in' },
          { strokeDashoffset: total * 0.84, duration: 0.14, ease: 'none' },
          { strokeDashoffset: total * 0.66, duration: 0.32, ease: 'power2.in' },
          { strokeDashoffset: total * 0.58, duration: 0.16, ease: 'none' },
          { strokeDashoffset: total * 0.31, duration: 0.36, ease: 'power2.inOut' },
          { strokeDashoffset: total * 0.18, duration: 0.22, ease: 'power3.in' },
          { strokeDashoffset: 0, duration: 0.32, ease: 'power4.out' },
        ],
      },
      '<+0.08'
    )

  return () => {
    tl.kill()
  }
})
</script>

<style scoped>
.lp2-hero {
  min-height: calc(100vh - 58px);
  padding: 34px 0 28px;
  scroll-margin-top: 70px;
  display: grid;
  align-items: start;
}

.lp2-container {
  max-width: 1200px;
  padding: 0 18px;
  margin: 0 auto;
}

.lp2-hero-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  justify-items: center;
}

.lp2-hero-copy {
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
  max-width: 780px;
}

.lp2-h1-row {
  position: relative;
  display: block;
  width: 100%;
}

.lp2-h1 {
  margin: 0;
  font-weight: 820;
  font-size: 30px;
  line-height: 1.08;
  color: var(--pn-fg);
  max-width: 12em;
}

.lp2-h1-path {
  position: absolute;
  left: 50%;
  top: -10px;
  transform: translateX(-50%);
  width: min(100%, 900px);
  height: 80px;
  pointer-events: none;
}

.lp2-h1-path-line {
  fill: none;
  stroke: rgb(var(--pn-accent-rgb));
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.9;
}

.lp2-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--pn-muted);
  max-width: 62ch;
}

.lp2-hero-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
  justify-content: center;
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
  background: var(--pn-card);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.lp2-btn:hover {
  transform: translateY(-1px);
  background: var(--pn-card-2);
  border-color: rgb(var(--pn-accent-rgb) / 0.28);
}

.lp2-btn-primary {
  background: rgb(var(--pn-accent-rgb) / 0.18);
  border-color: rgb(var(--pn-accent-rgb) / 0.26);
}
.lp2-btn-primary:hover {
  background: rgb(var(--pn-accent-rgb) / 0.24);
  border-color: rgb(var(--pn-accent-rgb) / 0.36);
}

.lp2-hero-visual {
  display: grid;
  width: min(100%, 820px);
  margin: 0 auto;
}

@media (min-width: 860px) {
  .lp2-h1 {
    font-size: 38px;
  }
  .lp2-subtitle {
    font-size: 15px;
  }
}

@media (min-width: 980px) {
  .lp2-hero {
    padding: 40px 0 28px;
  }
  .lp2-hero-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .lp2-h1 {
    font-size: 42px;
  }
}

@media (max-width: 680px) {
  .lp2-hero {
    min-height: calc(100svh - 58px);
    padding: 18px 0 18px;
  }

  .lp2-container {
    padding: 0 12px;
  }

  .lp2-hero-grid {
    gap: 12px;
  }

  .lp2-h1 {
    font-size: 25px;
    max-width: 11em;
  }

  .lp2-h1-row {
    position: relative;
  }

  .lp2-h1-path {
    width: min(92vw, 900px);
    height: 66px;
    top: -8px;
  }

  .lp2-subtitle {
    font-size: 13px;
    line-height: 1.45;
    max-width: 32em;
  }

  .lp2-btn {
    height: 34px;
    padding: 0 10px;
    font-size: 12px;
  }
}

@media (max-width: 979.98px) {
  .lp2-hero-visual {
    width: 100%;
  }
}
</style>
