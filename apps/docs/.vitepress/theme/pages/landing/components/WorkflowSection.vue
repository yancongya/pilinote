<script setup lang="ts">
import { WORKFLOW } from '../content'
</script>

<template>
  <section id="workflow" class="lp2-section" data-reveal>
    <div class="lp2-container">
      <div class="lp2-section-head">
        <h2 class="lp2-h2">工作流</h2>
        <p class="lp2-sub">从同步（收藏夹/稍后再看/历史/订阅文件夹）到回跳复习，一条链路走完。</p>
      </div>

      <div class="lp2-flow">
        <div class="lp2-flow-rail" aria-hidden="true">
          <div class="lp2-flow-rail-line" />
          <div class="lp2-flow-rail-dots" :style="{ gridTemplateColumns: `repeat(${WORKFLOW.length}, 1fr)` }">
            <span v-for="(_, idx) in WORKFLOW" :key="idx" class="lp2-flow-dot" />
          </div>
        </div>

        <ol class="lp2-flow-steps">
          <li v-for="(s, idx) in WORKFLOW" :key="s.title" class="lp2-flow-step">
            <div class="lp2-flow-badge">{{ idx + 1 }}</div>
            <div class="lp2-flow-body">
              <div class="lp2-flow-title">{{ s.title }}</div>
              <div class="lp2-flow-desc">{{ s.desc }}</div>
              <div class="lp2-flow-meta">{{ s.meta }}</div>
            </div>
          </li>
        </ol>
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

.lp2-flow {
  border-radius: 18px;
  border: 1px solid var(--pn-border);
  background:
    radial-gradient(900px 240px at 15% 0%, rgb(var(--pn-accent-rgb) / 0.1), transparent 62%),
    radial-gradient(720px 240px at 86% 4%, rgb(var(--pn-blue-rgb) / 0.1), transparent 60%),
    var(--pn-card);
  padding: 18px;
  overflow: hidden;
}

.lp2-flow-rail {
  position: relative;
  margin-bottom: 14px;
}

.lp2-flow-rail-line {
  height: 2px;
  background: linear-gradient(90deg, rgb(var(--pn-accent-rgb) / 0.48), rgb(var(--pn-blue-rgb) / 0.34), color-mix(in srgb, var(--pn-fg) 14%, transparent));
  border-radius: 999px;
}

.lp2-flow-rail-dots {
  position: absolute;
  inset: -7px 0 auto 0;
  display: grid;
  align-items: center;
}

.lp2-flow-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: rgb(var(--pn-accent-rgb) / 0.18);
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.26);
  box-shadow: 0 0 0 4px rgb(var(--pn-accent-rgb) / 0.12);
  justify-self: center;
}

.lp2-flow-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.lp2-flow-step {
  border-radius: 14px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 74%, transparent);
  padding: 14px;
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 12px;
  box-shadow: var(--pn-soft-shadow);
}

.lp2-flow-badge {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: rgb(var(--pn-accent-rgb) / 0.16);
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.26);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 760;
  color: var(--pn-fg);
  font-size: 13px;
}

.lp2-flow-title {
  font-weight: 760;
  margin-bottom: 4px;
}

.lp2-flow-desc {
  color: var(--pn-muted);
  font-size: 14px;
  line-height: 1.6;
}

.lp2-flow-meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--pn-muted);
  opacity: 0.85;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

@media (min-width: 860px) {
  .lp2-h2 {
    font-size: 24px;
  }
  .lp2-flow-steps {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
  }
  .lp2-flow-step {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 860px) and (max-width: 1080px) {
  .lp2-flow-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
