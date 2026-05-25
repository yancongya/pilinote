<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { prefersReducedMotion } from '../../../lib/motion'
import { NAV } from '../content'

const props = defineProps<{ active: { value: string } | string }>()
const emit = defineEmits<{ (e: 'nav', id: string): void }>()

const activeId = computed(() => (typeof props.active === 'string' ? props.active : props.active.value))

const { isDark } = useData()

function onToggleTheme(e: MouseEvent) {
  e.preventDefault()
  if (prefersReducedMotion()) {
    isDark.value = !isDark.value
    return
  }

  const doc = document as Document & {
    startViewTransition?: (updateCallback: () => void) => { ready: Promise<void> }
  }

  if (!doc.startViewTransition) {
    isDark.value = !isDark.value
    return
  }

  const x = e.clientX
  const y = e.clientY
  const maxX = Math.max(x, window.innerWidth - x)
  const maxY = Math.max(y, window.innerHeight - y)
  const endRadius = Math.hypot(maxX, maxY)

  const toDark = !isDark.value
  const transition = doc.startViewTransition(() => {
    isDark.value = toDark
  })

  transition.ready.then(() => {
    const keyframes = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
    document.documentElement.animate(
      { clipPath: keyframes },
      {
        duration: 460,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        pseudoElement: '::view-transition-new(root)',
      }
    )
  })
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
          class="lp2-mode-btn"
          type="button"
          :aria-label="isDark ? '切换到亮色主题' : '切换到暗色主题'"
          @click="onToggleTheme"
        >
          <span class="lp2-mode-icon" aria-hidden="true">{{ isDark ? '◐' : '◑' }}</span>
        </button>
        <a class="lp2-cta" :href="withBase('/guide/')">立即开始</a>
      </div>
    </div>
  </header>
</template>

<style scoped>
:global(::view-transition-old(root)),
:global(::view-transition-new(root)) {
  animation: none;
}

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
  gap: 8px;
}

.lp2-mode-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 74%, transparent);
  color: var(--pn-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
}
.lp2-mode-btn:hover {
  background: color-mix(in srgb, var(--pn-card-2) 86%, transparent);
  border-color: rgb(var(--pn-accent-rgb) / 0.24);
  color: var(--pn-fg);
}

.lp2-mode-icon {
  font-size: 13px;
  line-height: 1;
}

.lp2-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--pn-bg) 74%, transparent);
  border: 1px solid var(--pn-border);
  color: var(--pn-fg);
  text-decoration: none;
  font-size: 13px;
  font-weight: 620;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
}
.lp2-cta:hover {
  background: color-mix(in srgb, var(--pn-card-2) 86%, transparent);
  border-color: rgb(var(--pn-accent-rgb) / 0.24);
}

@media (min-width: 860px) {
  .lp2-nav {
    display: flex;
  }
}
</style>
