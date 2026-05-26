<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <footer class="lp2-footer">
    <div class="lp2-container lp2-footer-inner">
      <div class="lp2-footer-left">
        <div class="lp2-footer-brand">PiliNote</div>
        <div class="lp2-footer-muted">收藏夹杀手 · 本地下载与 AI 总结</div>
      </div>

      <div class="lp2-footer-right">
        <a class="lp2-footer-link" :href="withBase('/guide/')">使用指南</a>
        <span class="sep" aria-hidden="true">·</span>
        <a class="lp2-footer-link" :href="withBase('/dev/')">开发文档</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.lp2-footer {
  border-top: 1px solid var(--pn-border);
  background: var(--pn-card);
  padding: 18px 0;
}

.lp2-container {
  max-width: 1200px;
  padding: 0 18px;
  margin: 0 auto;
}

.lp2-footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.lp2-footer-brand {
  font-weight: 760;
}

.lp2-footer-muted {
  margin-top: 2px;
  color: var(--pn-muted);
  font-size: 13px;
}

.lp2-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--pn-muted);
  font-size: 13px;
}

.lp2-footer-link {
  color: var(--pn-muted);
  text-decoration: none;
}
.lp2-footer-link:hover {
  color: var(--pn-fg);
}

.sep {
  color: var(--pn-muted);
  opacity: 0.6;
}
</style>
