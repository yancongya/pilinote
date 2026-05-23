<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useReducedMotionGuard } from '../lib/motion'

type Cta = { label: string; href: string }
type Feature = { title: string; desc: string }
type Step = { title: string; desc: string }
type DevLink = { title: string; desc: string; href: string }
type Faq = { q: string; a: string }

const heroRef = ref<HTMLElement | null>(null)
const screenshotsRef = ref<HTMLElement | null>(null)
const featuresRef = ref<HTMLElement | null>(null)
const workflowRef = ref<HTMLElement | null>(null)

const primaryCta: Cta = { label: '下载/安装', href: '/guide/' }
const secondaryCta: Cta = { label: '使用指南', href: '/guide/' }

const bullets: string[] = [
  '收藏夹杀手：收藏/稍后再看/订阅跟踪',
  '自动下载：队列/分P/sidecar 落盘',
  'AI 分析总结：结构化笔记 + 关键点时间戳',
  '回看更快：时间戳可回跳播放进度',
]

const features: Feature[] = [
  { title: '来源跟踪', desc: '收藏夹/稍后再看/订阅的增量扫描与跟踪。' },
  { title: '自动下载', desc: '队列调度、分P管理、下载策略与失败重试。' },
  { title: '产物落盘', desc: 'NFO/字幕/截图/笔记等 sidecar 与媒体同级保存。' },
  { title: 'AI 笔记', desc: '结构化总结、关键点时间戳，并可回跳播放进度。' },
  { title: '媒体库', desc: '统一浏览、筛选与回看已下载媒体。' },
  { title: '可配置', desc: '模型、提示词、自动化策略等均可调整与复用。' },
]

const steps: Step[] = [
  { title: '导入/扫描来源', desc: '收藏/稍后再看/订阅增量获取待处理内容。' },
  { title: '下载并落盘', desc: '视频与 sidecar 产物按规则落盘归档。' },
  { title: 'AI 分析生成笔记', desc: '对内容进行分析总结并生成可回跳的笔记。' },
  { title: '回看复习', desc: '点击时间戳快速定位关键片段，提升复习效率。' },
]

const devLinks: DevLink[] = [
  { title: '架构', desc: '系统结构、模块与数据流', href: '/dev/architecture/README' },
  { title: 'API', desc: '接口与实现说明', href: '/dev/api/README' },
  { title: '前端实现', desc: '页面与组件实现文档', href: '/dev/web/README' },
  { title: '数据库', desc: '表结构与数据模型', href: '/dev/database/README' },
]

const faqs: Faq[] = [
  { q: '是否离线可用？', a: '核心流程以本地落盘与本地管理为主；涉及在线获取内容与部分 AI 能力时需要网络。' },
  { q: '数据存在哪里？', a: '媒体与 sidecar 文件落在本地目录；具体路径可在设置中配置。' },
  { q: 'AI 用的是什么模型/可否关闭？', a: '支持配置模型与提示词；你也可以只用下载管理与媒体库能力。' },
  { q: '字幕/ASR 的来源与策略？', a: '优先使用可获得的字幕；必要时可通过本地转写补齐（以当前实现为准）。' },
]

function scrollToHash(hash: string) {
  const el = document.querySelector(hash)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

useReducedMotionGuard(async () => {
  const { gsap } = await import('gsap')
  const { ScrollTrigger } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ScrollTrigger)

  const ctx = gsap.context(() => {
    if (heroRef.value) {
      const targets = heroRef.value.querySelectorAll('[data-hero]')
      gsap.fromTo(
        targets,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.04 }
      )
    }

    if (screenshotsRef.value) {
      const cards = screenshotsRef.value.querySelectorAll('[data-shot]')
      gsap.fromTo(
        cards,
        { y: 12, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.35,
          ease: 'power2.out',
          stagger: 0.06,
          scrollTrigger: { trigger: screenshotsRef.value, start: 'top 75%' },
        }
      )
    }

    if (featuresRef.value) {
      const cards = featuresRef.value.querySelectorAll('[data-feature]')
      gsap.fromTo(
        cards,
        { y: 10, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.32,
          ease: 'power2.out',
          stagger: 0.04,
          scrollTrigger: { trigger: featuresRef.value, start: 'top 75%' },
        }
      )
    }

    if (workflowRef.value) {
      const items = workflowRef.value.querySelectorAll('[data-step]')
      gsap.fromTo(
        items,
        { y: 10, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.32,
          ease: 'power2.out',
          stagger: 0.06,
          scrollTrigger: { trigger: workflowRef.value, start: 'top 75%' },
        }
      )
    }
  })

  return () => ctx.revert()
})

onMounted(() => {
  if (location.hash) {
    scrollToHash(location.hash)
  }
})
</script>

<template>
  <div class="lp-shell">
    <header class="lp-topbar">
      <div class="lp-topbar-inner">
        <a class="lp-brand" href="/">
          <span class="lp-dot" aria-hidden="true" />
          <span class="lp-brand-text">PiliNote</span>
        </a>

        <nav class="lp-nav" aria-label="主导航">
          <a class="lp-nav-link is-active" href="/">落地页</a>
          <a class="lp-nav-link" href="/dev/">开发文档</a>
          <a class="lp-nav-link" href="/guide/">使用指南</a>
        </nav>

        <div class="lp-topbar-actions">
          <a class="lp-link-btn" href="/guide/">下载/安装</a>
        </div>
      </div>
    </header>

    <main class="lp-main">
      <section class="lp-hero" ref="heroRef">
        <div class="lp-container">
          <div class="lp-hero-grid">
            <div class="lp-hero-copy">
              <h1 class="lp-h1" data-hero>PiliNote</h1>
              <p class="lp-subtitle" data-hero>面向 B 站的下载与 AI 总结工具，专治收藏夹堆积。</p>

              <ul class="lp-bullets" data-hero>
                <li v-for="b in bullets" :key="b">{{ b }}</li>
              </ul>

              <div class="lp-cta" data-hero>
                <a class="lp-btn lp-btn-primary" :href="primaryCta.href">{{ primaryCta.label }}</a>
                <a class="lp-btn lp-btn-secondary" :href="secondaryCta.href">{{ secondaryCta.label }}</a>
              </div>

              <div class="lp-meta" data-hero>
                <a class="lp-muted-link" href="#thanks">参考与致谢</a>
                <span class="lp-dot-sep" aria-hidden="true">·</span>
                <a class="lp-muted-link" href="/dev/">开发文档</a>
              </div>
            </div>

            <div class="lp-hero-panel" data-hero>
              <div class="lp-hero-panel-title">界面预览（占位）</div>
              <div class="lp-hero-panel-body">
                <div class="lp-shot-placeholder">
                  <div class="lp-shot-placeholder-inner">媒体库 / 下载列表</div>
                </div>
                <div class="lp-shot-placeholder">
                  <div class="lp-shot-placeholder-inner">视频详情 / AI 笔记</div>
                </div>
                <div class="lp-shot-placeholder">
                  <div class="lp-shot-placeholder-inner">设置 / AI 配置</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="lp-section" id="screenshots" ref="screenshotsRef">
        <div class="lp-container">
          <div class="lp-section-head">
            <h2 class="lp-h2">界面预览</h2>
            <p class="lp-section-sub">先用占位，后续替换为真实截图。</p>
          </div>

          <div class="lp-shot-grid">
            <div class="lp-shot-card" data-shot>
              <div class="lp-shot-frame"><div class="lp-shot-frame-inner">媒体库 / 下载列表</div></div>
            </div>
            <div class="lp-shot-card" data-shot>
              <div class="lp-shot-frame"><div class="lp-shot-frame-inner">视频详情 / AI 笔记</div></div>
            </div>
            <div class="lp-shot-card" data-shot>
              <div class="lp-shot-frame"><div class="lp-shot-frame-inner">设置 / AI 配置</div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="lp-section" id="features" ref="featuresRef">
        <div class="lp-container">
          <div class="lp-section-head">
            <h2 class="lp-h2">核心能力</h2>
            <p class="lp-section-sub">面向“收藏夹杀手”的下载与 AI 总结链路。</p>
          </div>

          <div class="lp-feature-grid">
            <article v-for="f in features" :key="f.title" class="lp-feature-card" data-feature>
              <h3 class="lp-h3">{{ f.title }}</h3>
              <p class="lp-p">{{ f.desc }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="lp-section" id="workflow" ref="workflowRef">
        <div class="lp-container">
          <div class="lp-section-head">
            <h2 class="lp-h2">工作流</h2>
            <p class="lp-section-sub">从来源跟踪到回跳复习，一条链路走完。</p>
          </div>

          <ol class="lp-steps">
            <li v-for="(s, idx) in steps" :key="s.title" class="lp-step" data-step>
              <div class="lp-step-index">{{ idx + 1 }}</div>
              <div class="lp-step-body">
                <div class="lp-step-title">{{ s.title }}</div>
                <div class="lp-step-desc">{{ s.desc }}</div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="lp-section" id="dev">
        <div class="lp-container">
          <div class="lp-section-head">
            <h2 class="lp-h2">开发者入口</h2>
            <p class="lp-section-sub">面向二开、调试与贡献的文档入口。</p>
          </div>

          <div class="lp-dev-grid">
            <a v-for="l in devLinks" :key="l.title" class="lp-dev-card" :href="l.href">
              <div class="lp-dev-title">{{ l.title }}</div>
              <div class="lp-dev-desc">{{ l.desc }}</div>
            </a>
          </div>
        </div>
      </section>

      <section class="lp-section" id="faq">
        <div class="lp-container">
          <div class="lp-section-head">
            <h2 class="lp-h2">FAQ</h2>
            <p class="lp-section-sub">常见问题与边界条件，以当前实现为准。</p>
          </div>

          <div class="lp-faq">
            <details v-for="item in faqs" :key="item.q" class="lp-faq-item">
              <summary class="lp-faq-q">{{ item.q }}</summary>
              <div class="lp-faq-a">{{ item.a }}</div>
            </details>
          </div>
        </div>
      </section>

      <section class="lp-section" id="thanks">
        <div class="lp-container">
          <div class="lp-section-head">
            <h2 class="lp-h2">参考与致谢</h2>
            <p class="lp-section-sub">本项目开发过程中参考了相关开源项目的思路与实现。</p>
          </div>

          <p class="lp-p">
            本项目开发过程中参考了：bilinote、bilisync、bilitools、pilipala 等开源项目。
          </p>
        </div>
      </section>
    </main>

    <footer class="lp-footer">
      <div class="lp-container lp-footer-inner">
        <div class="lp-footer-left">PiliNote</div>
        <div class="lp-footer-right">
          <a class="lp-muted-link" href="/dev/">开发文档</a>
          <span class="lp-dot-sep" aria-hidden="true">·</span>
          <a class="lp-muted-link" href="/guide/">使用指南</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.lp-shell {
  color: rgba(255, 255, 255, 0.92);
  background: #0b0d12;
  min-height: 100vh;
}

.lp-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  backdrop-filter: saturate(120%) blur(10px);
  background: rgba(11, 13, 18, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.lp-topbar-inner {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1200px;
  padding: 0 16px;
  margin: 0 auto;
}

.lp-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 650;
  text-decoration: none;
  color: inherit;
}

.lp-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #4f8cff;
  box-shadow: 0 0 0 4px rgba(79, 140, 255, 0.18);
}

.lp-nav {
  display: none;
  gap: 14px;
}

.lp-nav-link {
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  font-size: 14px;
  padding: 8px 10px;
  border-radius: 8px;
}
.lp-nav-link:hover {
  color: rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.06);
}
.lp-nav-link.is-active {
  color: rgba(255, 255, 255, 0.95);
}

.lp-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  font-size: 14px;
}
.lp-link-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.lp-main {
  padding-bottom: 64px;
}

.lp-container {
  max-width: 1200px;
  padding: 0 16px;
  margin: 0 auto;
}

.lp-hero {
  padding: 56px 0 24px;
}

.lp-hero-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}

.lp-h1 {
  font-size: 44px;
  line-height: 1.1;
  margin: 0 0 12px 0;
  letter-spacing: 0;
}

.lp-subtitle {
  margin: 0 0 16px 0;
  font-size: 16px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.76);
}

.lp-bullets {
  margin: 0 0 18px 0;
  padding-left: 18px;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.7;
}

.lp-cta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.lp-btn {
  height: 44px;
  min-width: 120px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.lp-btn-primary {
  background: rgba(79, 140, 255, 0.18);
  color: rgba(255, 255, 255, 0.94);
}
.lp-btn-primary:hover {
  background: rgba(79, 140, 255, 0.24);
}

.lp-btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
}
.lp-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.lp-meta {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}

.lp-muted-link {
  color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
}
.lp-muted-link:hover {
  color: rgba(255, 255, 255, 0.92);
}

.lp-dot-sep {
  margin: 0 8px;
  color: rgba(255, 255, 255, 0.4);
}

.lp-hero-panel {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  padding: 14px;
}

.lp-hero-panel-title {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 12px;
}

.lp-hero-panel-body {
  display: grid;
  gap: 10px;
}

.lp-shot-placeholder {
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.02);
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lp-shot-placeholder-inner {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
}

.lp-section {
  padding: 48px 0;
}

.lp-section-head {
  margin-bottom: 18px;
}

.lp-h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
  line-height: 1.25;
}

.lp-section-sub {
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  font-size: 14px;
}

.lp-shot-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.lp-shot-card {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
}

.lp-shot-frame {
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.02);
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lp-shot-frame-inner {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
}

.lp-feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.lp-feature-card {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  padding: 14px;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
}
.lp-feature-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.14);
}

.lp-h3 {
  margin: 0 0 6px 0;
  font-size: 15px;
}

.lp-p {
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.65;
  font-size: 14px;
}

.lp-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.lp-step {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  padding: 14px;
}

.lp-step-index {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: rgba(79, 140, 255, 0.16);
  border: 1px solid rgba(79, 140, 255, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 650;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
}

.lp-step-title {
  font-weight: 650;
  margin-bottom: 4px;
}

.lp-step-desc {
  color: rgba(255, 255, 255, 0.72);
  font-size: 14px;
  line-height: 1.6;
}

.lp-dev-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.lp-dev-card {
  display: block;
  text-decoration: none;
  color: inherit;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  padding: 14px;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
}
.lp-dev-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.14);
}

.lp-dev-title {
  font-weight: 650;
  margin-bottom: 6px;
}

.lp-dev-desc {
  color: rgba(255, 255, 255, 0.72);
  font-size: 14px;
  line-height: 1.6;
}

.lp-faq {
  display: grid;
  gap: 10px;
}

.lp-faq-item {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px 14px;
}

.lp-faq-q {
  cursor: pointer;
  font-weight: 650;
}

.lp-faq-a {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.65;
  font-size: 14px;
}

.lp-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  padding: 18px 0;
}

.lp-footer-inner {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

@media (min-width: 860px) {
  .lp-nav {
    display: inline-flex;
  }
  .lp-hero {
    padding: 72px 0 32px;
  }
  .lp-hero-grid {
    grid-template-columns: 1.15fr 0.85fr;
    align-items: start;
  }
  .lp-shot-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .lp-feature-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .lp-dev-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

