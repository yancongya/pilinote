<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { withBase } from 'vitepress'

type Tab = { id: string; label: string; asset: string; desc: string }

const tabs: Tab[] = [
  { id: 'library', label: '媒体库/下载列表', asset: '/landing/mock-library.svg', desc: '批量同步、下载状态、本地媒体统一展示。' },
  { id: 'detail', label: '视频详情/AI 笔记', asset: '/landing/mock-detail.svg', desc: 'AI 笔记、章节、关键点和时间戳回跳集中在详情页。' },
  { id: 'settings', label: '设置/AI 配置', asset: '/landing/mock-settings.svg', desc: '下载目录、模型、提示词和自动化策略集中配置。' },
]

const active = ref<Tab['id']>('detail')
const shotRef = ref<HTMLElement | null>(null)

const current = computed(() => tabs.find((t) => t.id === active.value) ?? tabs[0])
const title = computed(() => current.value.label)

watch(active, async () => {
  if (!shotRef.value) return
  const { gsap } = await import('gsap')
  gsap.fromTo(
    shotRef.value,
    { autoAlpha: 0.72, y: 8, scale: 0.992 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' }
  )
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
        <div class="lp2-tabs" role="tablist" aria-label="Gallery tabs">
          <button
            v-for="t in tabs"
            :key="t.id"
            class="lp2-tab"
            type="button"
            role="tab"
            :aria-selected="active === t.id"
            :aria-controls="`gallery-panel-${t.id}`"
            :class="{ 'is-active': active === t.id }"
            @click="active = t.id"
          >
            {{ t.label }}
          </button>
        </div>

        <div
          :id="`gallery-panel-${current.id}`"
          ref="shotRef"
          class="lp2-shot2"
          role="tabpanel"
          :aria-label="title"
        >
          <div class="lp2-shot2-top">
            <span class="dot" />
            <span class="dot" />
            <span class="dot" />
            <span class="title">{{ title }}</span>
          </div>

          <div class="lp2-shot2-body">
            <div class="lp2-shot-media">
              <img class="lp2-shot-img" :src="withBase(current.asset)" :alt="`${title} 界面示意`" />
              <div class="lp2-shot-overlay">
                <div class="lp2-shot-label">{{ title }}</div>
                <p>{{ current.desc }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="lp2-gallery-hint">
          <span class="cap-dot" />
          <span>默认聚焦“视频详情/AI 笔记”，突出从视频回到知识点的核心价值。</span>
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
  max-width: 70ch;
}

.lp2-gallery2 {
  border-radius: 18px;
  border: 1px solid var(--pn-border);
  background: var(--pn-card);
  padding: 14px;
}

.lp2-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.lp2-tab {
  height: 34px;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid var(--pn-border);
  background: var(--pn-card);
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
  background: rgb(var(--pn-accent-rgb) / 0.16);
  border-color: rgb(var(--pn-accent-rgb) / 0.26);
  color: var(--pn-fg);
}

.lp2-shot2 {
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: var(--pn-card);
  overflow: hidden;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  will-change: transform, opacity;
}
.lp2-shot2:hover {
  transform: translateY(-2px);
  border-color: rgb(var(--pn-accent-rgb) / 0.28);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.36);
}

.lp2-shot2-top {
  height: 28px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-bottom: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 60%, transparent);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--pn-fg) 18%, transparent);
}

.title {
  margin-left: 8px;
  font-size: 12px;
  color: var(--pn-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lp2-shot2-body {
  padding: 12px;
  display: grid;
  gap: 10px;
}

.lp2-shot-media {
  width: 100%;
  position: relative;
  border-radius: 12px;
  border: 1px solid var(--pn-border);
  overflow: hidden;
  aspect-ratio: 16 / 9;
  background: var(--pn-app-panel);
}

.lp2-shot-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.lp2-shot-overlay {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(7, 10, 16, 0.68);
  backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.88);
  padding: 12px;
}

.lp2-shot-label {
  font-weight: 780;
  margin-bottom: 4px;
}

.lp2-shot-overlay p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.68);
}

.lp2-gallery-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--pn-muted);
  font-size: 13px;
  line-height: 1.5;
  margin-top: 12px;
}

.cap-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgb(var(--pn-accent-rgb));
  box-shadow: 0 0 0 5px rgb(var(--pn-accent-rgb) / 0.12);
  flex: 0 0 auto;
}

@media (min-width: 860px) {
  .lp2-h2 {
    font-size: 24px;
  }
}
</style>
