<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { prefersReducedMotion } from '../../../lib/motion'

const rootRef = ref<HTMLElement | null>(null)
let cleanup: (() => void) | undefined

const pairs = [
  { problem: '视频太多，找不到重点', solution: 'AI 笔记提炼章节、问题和结论' },
  { problem: '二刷成本高，时间轴难回跳', solution: '点击时间戳直接回到视频片段' },
  { problem: '看过就忘，没有可复习的产物', solution: '字幕、截图、NFO、笔记同级归档' },
  { problem: '视频下架后，收藏链接失效', solution: '提前下载，避免重要内容消失' },
  { problem: '不同场景总结结构不统一', solution: '自定义 Prompt 适配学习、代码、调研' },
  { problem: '本地资产缺少备份路径', solution: 'FTP / NAS 同步，长期保存和多设备访问' },
]

async function setupMotion() {
  if (!rootRef.value || prefersReducedMotion()) {
    rootRef.value?.classList.add('is-motion-complete')
    return
  }

  const { gsap } = await import('gsap')
  const { ScrollTrigger } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ScrollTrigger)

  const root = rootRef.value
  const rows = root.querySelectorAll('[data-why-row]')

  gsap.set(rows, { '--strike-scale': 0 })
  gsap.set(root.querySelectorAll('[data-solution-text]'), { autoAlpha: 0, y: 8 })

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: 'top top+=70',
      end: '+=900',
      scrub: 0.7,
      pin: true,
      anticipatePin: 1,
    },
    defaults: { ease: 'power2.out' },
  })

  rows.forEach((row) => {
    const problem = row.querySelector('[data-problem-text]')
    const solution = row.querySelector('[data-solution-text]')
    tl.to(row, { '--strike-scale': 1, duration: 0.34 })
      .to(problem, { autoAlpha: 0.18, x: -8, duration: 0.24 }, '<0.08')
      .to(solution, { autoAlpha: 1, y: 0, duration: 0.3 }, '<0.12')
  })

  cleanup = () => {
    tl.kill()
    ScrollTrigger.getAll().forEach((trigger) => {
      if (trigger.trigger === root) trigger.kill()
    })
  }
}

onMounted(() => {
  void setupMotion()
})

onBeforeUnmount(() => {
  cleanup?.()
})
</script>

<template>
  <section ref="rootRef" class="lp2-section lp2-why" data-reveal>
    <div class="lp2-container">
      <div class="lp2-section-head">
        <h2 class="lp2-h2">为什么需要 PiliNote</h2>
        <p class="lp2-sub">
          滚动到这里后页面会停住：每一条现状被划掉，再切换成 PiliNote 的解决方式。
        </p>
      </div>

      <div class="lp2-why-board">
        <article v-for="(item, index) in pairs" :key="item.problem" class="lp2-why-row" data-why-row>
          <div class="lp2-row-index">{{ String(index + 1).padStart(2, '0') }}</div>
          <div class="lp2-row-copy">
            <div class="lp2-row-label">现状</div>
            <div class="lp2-problem" data-problem-text>
              <span>{{ item.problem }}</span>
            </div>
          </div>
          <div class="lp2-row-arrow" aria-hidden="true">→</div>
          <div class="lp2-row-copy is-solution">
            <div class="lp2-row-label">解决</div>
            <div class="lp2-solution" data-solution-text>{{ item.solution }}</div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lp2-section {
  min-height: calc(100vh - 58px);
  padding: 42px 0;
  display: grid;
  align-items: center;
}

.lp2-container {
  max-width: 1040px;
  padding: 0 18px;
  margin: 0 auto;
  width: 100%;
}

.lp2-section-head {
  margin-bottom: 16px;
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

.lp2-why-board {
  display: grid;
  gap: 8px;
}

.lp2-why-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 28px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-height: 58px;
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 70%, transparent);
  padding: 10px 12px;
  box-shadow: var(--pn-soft-shadow);
}

.lp2-row-index {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.22);
  background: rgb(var(--pn-accent-rgb) / 0.1);
  color: var(--pn-fg);
  font-size: 12px;
  font-weight: 760;
}

.lp2-row-label {
  color: var(--pn-muted);
  font-size: 11px;
  margin-bottom: 2px;
}

.lp2-problem,
.lp2-solution {
  font-size: 14px;
  line-height: 1.35;
}

.lp2-problem {
  color: var(--pn-muted);
}

.lp2-problem span {
  position: relative;
  display: inline-block;
}

.lp2-problem span::after {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: 54%;
  height: 2px;
  border-radius: 999px;
  background: rgb(var(--pn-accent-rgb));
  transform: scaleX(var(--strike-scale, 0));
  transform-origin: left center;
}

.lp2-row-arrow {
  color: rgb(var(--pn-accent-rgb));
  font-weight: 760;
  text-align: center;
}

.lp2-solution {
  color: var(--pn-fg);
  font-weight: 650;
}

.is-motion-complete [data-solution-text] {
  opacity: 1;
  visibility: visible;
  transform: none;
}

@media (max-width: 680px) {
  .lp2-section {
    min-height: calc(100svh - 58px);
    padding: 22px 0;
  }

  .lp2-container {
    padding: 0 12px;
  }

  .lp2-section-head {
    margin-bottom: 10px;
  }

  .lp2-h2 {
    font-size: 20px;
  }

  .lp2-sub {
    font-size: 13px;
    line-height: 1.45;
  }

  .lp2-why-board {
    gap: 7px;
  }

  .lp2-why-row {
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 8px;
    min-height: 64px;
    padding: 8px;
  }

  .lp2-row-index {
    width: 26px;
    height: 26px;
    border-radius: 10px;
    font-size: 11px;
  }

  .lp2-row-arrow,
  .lp2-row-copy.is-solution .lp2-row-label {
    display: none;
  }

  .lp2-row-copy.is-solution {
    grid-column: 2;
  }

  .lp2-problem,
  .lp2-solution {
    font-size: 12px;
  }
}
</style>
