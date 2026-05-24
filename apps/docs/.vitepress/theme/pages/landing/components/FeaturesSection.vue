<script setup lang="ts">
import { FEATURES } from '../content'
</script>

<template>
  <section id="features" class="lp2-section" data-reveal>
    <div class="lp2-container">
      <div class="lp2-section-head">
        <h2 class="lp2-h2">核心能力</h2>
        <p class="lp2-sub">每一项能力都对应可落盘的产物，让“下载 + 复习”变成稳定工作流。</p>
      </div>

      <div class="lp2-feature-split">
        <div class="lp2-feature-left">
          <div class="lp2-artifacts">
            <div class="lp2-art-title">落盘产物（sidecar）</div>
            <div class="lp2-art-desc">和媒体同级保存，目录结构稳定可迁移。</div>
            <ul class="lp2-art-list">
              <li><span class="k">.nfo</span> 元数据</li>
              <li><span class="k">.srt/.vtt</span> 字幕</li>
              <li><span class="k">.ai-note.md</span> AI 笔记</li>
              <li><span class="k">.jpg</span> 原片截图</li>
              <li><span class="k">.json</span> 链路日志/缓存</li>
            </ul>
          </div>

          <div class="lp2-tree" aria-label="本地目录结构示意（占位）">
            <div class="lp2-tree-title">本地目录结构（示意）</div>
            <pre class="lp2-tree-pre">
downloads/
  BVxxxxxx/
    video.mp4
    video.nfo
    subtitle.srt
    note.ai-note.md
    note.screenshot.000125.jpg
            </pre>
          </div>
        </div>

        <div class="lp2-feature-right">
          <article v-for="f in FEATURES" :key="f.title" class="lp2-feature-card">
            <h3 class="lp2-h3">{{ f.title }}</h3>
            <p class="lp2-p">{{ f.desc }}</p>
            <ul class="lp2-ul">
              <li v-for="b in f.bullets" :key="b">{{ b }}</li>
            </ul>
          </article>
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

.lp2-feature-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.lp2-feature-left {
  display: grid;
  gap: 12px;
}

.lp2-artifacts,
.lp2-tree {
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: var(--pn-card);
  padding: 16px;
}

.lp2-art-title,
.lp2-tree-title {
  font-weight: 760;
  margin-bottom: 6px;
}

.lp2-art-desc {
  color: var(--pn-muted);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 10px;
}

.lp2-art-list {
  margin: 0;
  padding-left: 18px;
  color: var(--pn-muted);
  line-height: 1.75;
  font-size: 13px;
}

.lp2-art-list .k {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  color: var(--pn-fg);
}

.lp2-tree-pre {
  margin: 0;
  padding: 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--pn-fg) 4%, transparent);
  border: 1px solid var(--pn-border);
  color: var(--pn-muted);
  font-size: 12px;
  line-height: 1.6;
  overflow: auto;
}

.lp2-feature-right {
  display: grid;
  gap: 12px;
}

.lp2-feature-card {
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: var(--pn-card);
  padding: 16px;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
}
.lp2-feature-card:hover {
  transform: translateY(-2px);
  background: var(--pn-card-2);
  border-color: rgb(var(--pn-accent-rgb) / 0.22);
}

.lp2-h3 {
  margin: 0 0 6px 0;
  font-size: 15px;
}

.lp2-p {
  margin: 0 0 10px 0;
  color: var(--pn-muted);
  line-height: 1.65;
  font-size: 14px;
}

.lp2-ul {
  margin: 0;
  padding-left: 18px;
  color: var(--pn-muted);
  line-height: 1.75;
  font-size: 13px;
}

@media (min-width: 860px) {
  .lp2-h2 {
    font-size: 24px;
  }
  .lp2-feature-split {
    grid-template-columns: 0.95fr 1.05fr;
    gap: 14px;
  }
}
</style>
