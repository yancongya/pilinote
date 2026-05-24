<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { NAV } from '../content'

const props = defineProps<{ active: { value: string } | string }>()
const emit = defineEmits<{ (e: 'nav', id: string): void }>()

const activeId = computed(() => (typeof props.active === 'string' ? props.active : props.active.value))

const { isDark } = useData()

function onToggleTheme(e: MouseEvent) {
  // VitePress does not expose DefaultTheme's view-transition helper as a named export
  // (it is wired internally). For landing we keep it simple: flip the reactive flag.
  // This updates the `.dark` class and persists via VitePress appearance handling.
  e.preventDefault()
  isDark.value = !isDark.value
}
</script>

<template>
  <header class="lp2-topbar">
    <div class="lp2-topbar-inner">
      <a class="lp2-brand" :href="withBase('/')" aria-label="PiliNote Home">
        <span class="lp2-logo" aria-hidden="true">
          <img class="lp2-logo-img" src="/brand/logo.png" alt="" />
        </span>
        <span class="lp2-brand-text">PiliNote</span>
      </a>

      <nav class="lp2-nav" aria-label="Landing nav">
        <button
          v-for="n in NAV"
          :key="n.id"
          class="lp2-nav-btn"
          :class="{ 'is-active': activeId === n.id }"
          type="button"
          @click="emit('nav', n.id)"
        >
          {{ n.label }}
        </button>
      </nav>

      <div class="lp2-topbar-actions">
        <button
          class="lp2-icon-btn"
          type="button"
          :aria-label="isDark ? '切换到亮色主题' : '切换到暗色主题'"
          @click="onToggleTheme"
        >
          <span class="lp2-icon" aria-hidden="true">{{ isDark ? '🌙' : '☀️' }}</span>
        </button>
        <a class="lp2-cta" :href="withBase('/guide/')">立即开始</a>
      </div>
    </div>
  </header>
</template>

<style scoped>
.lp2-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: saturate(120%) blur(10px);
  background: color-mix(in srgb, var(--pn-bg) 72%, transparent);
  border-bottom: 1px solid var(--pn-border);
}

.lp2-topbar-inner {
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  max-width: 1200px;
  padding: 0 18px;
  margin: 0 auto;
}

.lp2-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 720;
  text-decoration: none;
  color: inherit;
  min-width: 132px;
}

.lp2-logo {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--pn-card);
  border: 1px solid var(--pn-border);
}

.lp2-logo-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.lp2-brand-text {
  font-size: 14px;
  color: var(--pn-fg);
}

.lp2-nav {
  display: none;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.lp2-nav-btn {
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--pn-muted);
  font-size: 13px;
  cursor: pointer;
}
.lp2-nav-btn:hover {
  color: var(--pn-fg);
  background: color-mix(in srgb, var(--pn-fg) 6%, transparent);
}
.lp2-nav-btn.is-active {
  color: var(--pn-fg);
  background: rgb(var(--pn-accent-rgb) / 0.16);
  border-color: rgb(var(--pn-accent-rgb) / 0.22);
}

.lp2-topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.lp2-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--pn-border);
  background: var(--pn-card);
  color: var(--pn-fg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.lp2-icon-btn:hover {
  background: var(--pn-card-2);
  border-color: rgb(var(--pn-accent-rgb) / 0.28);
  transform: translateY(-1px);
}

.lp2-icon {
  font-size: 14px;
  line-height: 1;
}

.lp2-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  background: var(--pn-card);
  border: 1px solid var(--pn-border);
  color: var(--pn-fg);
  text-decoration: none;
  font-size: 13px;
  font-weight: 650;
}
.lp2-cta:hover {
  background: var(--pn-card-2);
}

@media (min-width: 860px) {
  .lp2-nav {
    display: flex;
  }
}
</style>
