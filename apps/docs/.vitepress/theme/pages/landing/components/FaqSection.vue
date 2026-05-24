<script setup lang="ts">
import { FAQS } from '../content'
</script>

<template>
  <section id="faq" class="lp2-section" data-reveal>
    <div class="lp2-container">
      <div class="lp2-section-head">
        <h2 class="lp2-h2">FAQ</h2>
        <p class="lp2-sub">常见问题与边界条件，以当前实现为准。</p>
      </div>

      <div class="lp2-faq">
        <details v-for="item in FAQS" :key="item.q" class="lp2-faq-item">
          <summary class="lp2-faq-q">{{ item.q }}</summary>
          <div class="lp2-faq-a">{{ item.a }}</div>
        </details>
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

.lp2-faq {
  display: grid;
  gap: 10px;
}

.lp2-faq-item {
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: var(--pn-card);
  padding: 12px 14px;
}

.lp2-faq-q {
  cursor: pointer;
  font-weight: 760;
}

.lp2-faq-a {
  margin-top: 8px;
  color: var(--pn-muted);
  line-height: 1.65;
  font-size: 14px;
}

@media (min-width: 860px) {
  .lp2-h2 {
    font-size: 24px;
  }
}
</style>
