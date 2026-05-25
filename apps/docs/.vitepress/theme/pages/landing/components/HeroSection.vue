<template>
  <section id="product" class="lp2-hero">
    <div class="lp2-container lp2-hero-grid">
      <div class="lp2-hero-copy">
        <h1 class="lp2-h1" data-hero>把 B 站收藏夹变成可复习的本地知识库</h1>
        <p class="lp2-subtitle" data-hero>
          同步收藏夹/稍后再看/历史/订阅文件夹，自动下载落盘，生成可回跳的 AI 笔记。
        </p>

        <div class="lp2-hero-cta" data-hero>
          <a class="lp2-btn lp2-btn-primary" href="#docs">查看文档</a>
          <a class="lp2-btn" href="#download">开始下载</a>
        </div>
      </div>

      <div class="lp2-hero-visual" data-hero aria-label="PiliNote 动态流程示意">
        <ProductDemo />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import ProductDemo from './ProductDemo.vue'
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

.lp2-h1 {
  margin: 0;
  font-weight: 820;
  font-size: 30px;
  line-height: 1.08;
  color: var(--pn-fg);
  max-width: 12em;
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
