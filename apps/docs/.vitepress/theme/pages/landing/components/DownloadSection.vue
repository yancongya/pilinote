<script setup lang="ts">
import { withBase } from 'vitepress'

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
</script>

<template>
  <section id="download" class="lp2-section lp2-section-compact" data-reveal>
    <div class="lp2-container">
      <div class="lp2-download-cta">
        <div class="lp2-download-copy">
          <div class="lp2-kicker">Download</div>
          <h2 class="lp2-h2">准备把收藏夹落成本地知识库了吗？</h2>
          <p class="lp2-sub">
            正式版本下载入口会放在这里。现在可以先查看使用指南或源码方式启动。
          </p>
          <div class="lp2-actions">
            <a class="lp2-btn lp2-btn-primary" :href="withBase('/guide/')">查看使用指南</a>
            <a class="lp2-btn" :href="withBase('/dev/')">源码运行说明</a>
          </div>
        </div>

        <div class="lp2-download-grid" aria-label="下载选项">
          <a
            v-for="item in downloads"
            :key="item.title"
            class="lp2-dl-card"
            :href="item.href ? withBase(item.href) : undefined"
            :aria-disabled="item.href ? undefined : 'true'"
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
