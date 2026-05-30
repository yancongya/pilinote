<script setup lang="ts">
import DefaultTheme, { VPNavBarSearch } from 'vitepress/theme'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRouter, withBase } from 'vitepress'
import LandingPage from './pages/landing/LandingPage.vue'
import { prefersReducedMotion } from './lib/motion'

type SidebarLinkItem = { text: string; link: string }
type SidebarGroupItem = { text: string; items: SidebarItem[]; collapsed?: boolean }
type SidebarItem = SidebarLinkItem | SidebarGroupItem

function isGroup(item: SidebarItem): item is SidebarGroupItem {
  return typeof (item as any)?.items !== 'undefined'
}

function flatten(items: SidebarItem[]): SidebarLinkItem[] {
  const out: SidebarLinkItem[] = []
  for (const it of items) {
    if (!it) continue
    if (isGroup(it)) out.push(...flatten(it.items))
    else out.push(it)
  }
  return out
}

const { frontmatter, page, theme, isDark } = useData()
const router = useRouter()
const routePath = computed(() => router.route.path)

const isLanding = computed(() => {
  // Home page only
  return page.value.relativePath === 'index.md' || frontmatter.value.pageType === 'landing'
})

// Use route path instead of relativePath: rewrites make relativePath unstable.
const isGuide = computed(() => routePath.value.startsWith('/guide/'))
const isDev = computed(() => routePath.value.startsWith('/dev/'))
const showCompactDocsNav = computed(() => isGuide.value || isDev.value)

const docsSidebarKey = computed(() => {
  if (isGuide.value) return '/guide/'
  if (isDev.value) return '/dev/'
  return null
})

const docsSidebarItems = computed<SidebarLinkItem[]>(() => {
  const key = docsSidebarKey.value
  if (!key) return []
  const sidebar = (theme.value as any)?.sidebar?.[key] as SidebarItem[] | undefined
  if (!Array.isArray(sidebar)) return []
  return flatten(sidebar)
})

const docsNavOpen = ref(false)
const docsQuery = ref('')
function closeDocsNav() {
  docsNavOpen.value = false
}

function openDocsNav() {
  docsNavOpen.value = true
}

watch(docsNavOpen, (open) => {
  if (!open) docsQuery.value = ''
})

function normalizeLink(link: string) {
  return link.split('#', 1)[0]
}

const activeLink = computed(() => normalizeLink(routePath.value))

const primaryGuide: Array<{ text: string; link: string }> = [
  { text: '快速开始', link: '/guide/quickstart' },
  { text: '登录与账号', link: '/guide/login' },
  { text: '路径与存储', link: '/guide/paths' },
  { text: '视频源与入队', link: '/guide/sources' },
  { text: '下载与落盘', link: '/guide/downloads' },
  { text: 'AI 配置', link: '/guide/ai' },
  { text: 'Cron 自动化', link: '/guide/cron' },
  { text: '媒体库与复盘', link: '/guide/library' },
  { text: '排错与FAQ', link: '/guide/troubleshooting' },
]

const primaryDev: Array<{ text: string; link: string }> = [{ text: '总览', link: '/dev/README' }]

const primaryItems = computed<Array<{ text: string; link: string }>>(() => (isGuide.value ? primaryGuide : primaryDev))

function toKeyword(s: string) {
  return s.trim().toLowerCase()
}

const filteredSidebarItems = computed(() => {
  const q = toKeyword(docsQuery.value)
  const all = docsSidebarItems.value
  if (!q) return all
  return all.filter((it) => (`${it.text} ${it.link}`).toLowerCase().includes(q))
})

const filteredPrimaryItems = computed(() => {
  const q = toKeyword(docsQuery.value)
  const all = primaryItems.value
  if (!q) return all
  return all.filter((it) => (`${it.text} ${it.link}`).toLowerCase().includes(q))
})

function onKeydown(e: KeyboardEvent) {
  const isMac = navigator.platform.toLowerCase().includes('mac')
  const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey
  if (metaOrCtrl && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    docsNavOpen.value ? closeDocsNav() : openDocsNav()
    return
  }
  if (e.key === 'Escape' && docsNavOpen.value) {
    e.preventDefault()
    closeDocsNav()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

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

router.onAfterRouteChange = () => {
  closeDocsNav()
}
</script>

<template>
  <LandingPage v-if="isLanding" />
  <div v-else :class="{ 'pn-compact-docs': showCompactDocsNav }">
    <header v-if="showCompactDocsNav" class="lp2-topbar">
      <div class="lp2-topbar-inner">
        <a class="lp2-brand" :href="withBase('/')" aria-label="PiliNote Home">
          <span class="lp2-logo" aria-hidden="true">
            <img class="lp2-logo-img" src="/brand/logo.png" alt="" />
          </span>
          <span class="lp2-brand-text">PiliNote</span>
        </a>

        <nav class="lp2-nav" aria-label="Docs nav">
          <a class="lp2-nav-link" :class="{ 'is-active': !isDev && !isGuide }" :href="withBase('/')">落地页</a>
          <a class="lp2-nav-link" :class="{ 'is-active': isDev }" :href="withBase('/dev/')">开发文档</a>
          <a class="lp2-nav-link" :class="{ 'is-active': isGuide }" :href="withBase('/guide/')">使用指南</a>
        </nav>

        <div class="lp2-topbar-actions">
          <div class="pn-docs-search" aria-label="Search">
            <VPNavBarSearch />
          </div>
          <button class="pn-docs-nav-btn" type="button" @click="docsNavOpen = !docsNavOpen" :aria-expanded="docsNavOpen">
            目录
          </button>
          <button
            class="lp2-mode-btn"
            type="button"
            :aria-label="isDark ? '切换到亮色主题' : '切换到暗色主题'"
            @click="onToggleTheme"
          >
            <span class="lp2-mode-icon" aria-hidden="true">{{ isDark ? '◐' : '◑' }}</span>
          </button>
        </div>
      </div>
    </header>

    <DefaultTheme.Layout>
      <template #nav-bar-content-after v-if="!showCompactDocsNav">
        <!-- default nav for non-doc pages -->
      </template>
    </DefaultTheme.Layout>

    <div v-if="docsNavOpen && showCompactDocsNav" class="pn-docs-nav-overlay" @click="closeDocsNav">
      <div class="pn-docs-nav-panel" @click.stop>
        <div class="pn-docs-nav-title">
          <span>{{ isGuide ? '使用指南' : '开发文档' }}</span>
          <span class="pn-docs-nav-kbd" aria-hidden="true">{{ navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K' }}</span>
        </div>
        <div class="pn-docs-nav-search">
          <input class="pn-docs-nav-input" v-model="docsQuery" type="search" placeholder="搜索文档..." autofocus />
        </div>
        <nav class="pn-docs-nav-list">
          <div class="pn-docs-nav-section" v-if="filteredPrimaryItems.length">
            <div class="pn-docs-nav-section-title">上手路径</div>
            <a
              v-for="it in filteredPrimaryItems"
              :key="it.link"
              class="pn-docs-nav-item"
              :class="{ 'is-active': activeLink === normalizeLink(it.link) }"
              :href="it.link"
              @click="closeDocsNav"
            >
              {{ it.text }}
            </a>
          </div>

          <div class="pn-docs-nav-section" v-if="filteredSidebarItems.length">
            <div class="pn-docs-nav-section-title">全部文档</div>
            <a
              v-for="it in filteredSidebarItems"
              :key="it.link"
              class="pn-docs-nav-item"
              :class="{ 'is-active': activeLink === normalizeLink(it.link) }"
              :href="it.link"
              @click="closeDocsNav"
            >
              {{ it.text }}
            </a>
          </div>

          <div v-if="!filteredPrimaryItems.length && !filteredSidebarItems.length" class="pn-docs-nav-empty">没有匹配结果</div>
        </nav>
      </div>
    </div>
  </div>
</template>

<style>
/* Docs pages: keep landing-style topbar, but redesign sidebar visuals. */
.pn-compact-docs {
  --vp-sidebar-width: 260px;
}

.pn-compact-docs .VPNavBar {
  display: none !important;
}

.pn-compact-docs .VPSidebar {
  background: color-mix(in srgb, var(--vp-c-bg) 82%, transparent);
  border-right: 1px solid rgb(var(--pn-accent-rgb) / 0.12);
  box-shadow: none !important;
  /* Default theme adds top padding for VPNavBar; we use our own topbar. */
  padding-top: 12px !important;
}

/* Make the sidebar feel lighter and more "product" like */
.pn-compact-docs .VPSidebar .title {
  font-weight: 700;
}

.pn-compact-docs .VPSidebarNav {
  padding-top: 12px !important;
  padding-bottom: 18px !important;
}

.pn-compact-docs .VPSidebar .group + .group {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgb(var(--pn-accent-rgb) / 0.08);
}

.pn-compact-docs .VPSidebar .group .VPSidebarItem .link {
  border-radius: 10px;
}

.pn-compact-docs .VPSidebar .group .VPSidebarItem .link:hover {
  background: rgb(var(--pn-accent-rgb) / 0.09);
}

.pn-compact-docs .VPSidebar .group .VPSidebarItem.is-active > .link {
  background: rgb(var(--pn-accent-rgb) / 0.12);
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.18);
}

.pn-compact-docs .VPSidebar {
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--pn-accent-rgb) / 0.22) transparent;
}

.pn-compact-docs .VPSidebar::-webkit-scrollbar {
  width: 8px;
}

.pn-compact-docs .VPSidebar::-webkit-scrollbar-track {
  background: transparent;
}

.pn-compact-docs .VPSidebar::-webkit-scrollbar-thumb {
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
  background-color: rgb(var(--pn-accent-rgb) / 0.18);
}

.pn-compact-docs .VPSidebar:hover::-webkit-scrollbar-thumb {
  background-color: rgb(var(--pn-accent-rgb) / 0.3);
}

.pn-docs-nav-btn {
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.22);
  background: rgb(var(--pn-accent-rgb) / 0.08);
  color: var(--vp-c-text-1);
  font-size: 13px;
  line-height: 32px;
  cursor: pointer;
}

.pn-docs-nav-btn:hover {
  background: rgb(var(--pn-accent-rgb) / 0.12);
}

.pn-docs-nav-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgb(0 0 0 / 0.42);
  backdrop-filter: blur(6px);
}

.pn-docs-nav-panel {
  position: absolute;
  top: calc(var(--vp-nav-height) + 10px);
  right: 12px;
  width: min(420px, calc(100vw - 24px));
  max-height: calc(100vh - var(--vp-nav-height) - 24px);
  overflow: auto;
  border-radius: 12px;
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.18);
  background: var(--vp-c-bg);
  box-shadow: 0 22px 80px rgb(0 0 0 / 0.38);
}

.pn-docs-nav-title {
  padding: 12px 14px;
  border-bottom: 1px solid var(--vp-c-border);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.pn-docs-nav-kbd {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--vp-c-text-2);
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.18);
  background: rgb(var(--pn-accent-rgb) / 0.08);
}

.pn-docs-nav-search {
  padding: 10px 12px;
  border-bottom: 1px solid var(--vp-c-border);
}

.pn-docs-nav-input {
  width: 100%;
  height: 36px;
  border-radius: 10px;
  padding: 0 12px;
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.18);
  background: rgb(var(--pn-accent-rgb) / 0.06);
  color: var(--vp-c-text-1);
  outline: none;
}

.pn-docs-nav-input:focus {
  border-color: rgb(var(--pn-accent-rgb) / 0.38);
  box-shadow: 0 0 0 4px rgb(var(--pn-accent-rgb) / 0.14);
}

.pn-docs-nav-list {
  display: grid;
  padding: 10px;
}

.pn-docs-nav-section {
  display: grid;
  gap: 2px;
  padding-bottom: 8px;
}

.pn-docs-nav-section + .pn-docs-nav-section {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--vp-c-border);
}

.pn-docs-nav-section-title {
  padding: 4px 10px 8px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.pn-docs-nav-item {
  padding: 8px 10px;
  border-radius: 10px;
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.pn-docs-nav-item:hover {
  background: rgb(var(--pn-accent-rgb) / 0.1);
}

.pn-docs-nav-item.is-active {
  background: rgb(var(--pn-accent-rgb) / 0.14);
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.22);
}

.pn-docs-nav-empty {
  padding: 14px 10px;
  color: var(--vp-c-text-2);
}

.lp2-nav-link {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 10px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--vp-c-text-2);
  border: 1px solid transparent;
}

.lp2-nav-link:hover {
  background: rgb(var(--pn-accent-rgb) / 0.08);
  color: var(--vp-c-text-1);
}

.lp2-nav-link.is-active {
  color: var(--vp-c-text-1);
  background: rgb(var(--pn-accent-rgb) / 0.12);
  border-color: rgb(var(--pn-accent-rgb) / 0.22);
}

.pn-docs-search :is(.VPNavBarSearch, .VPNavBarSearch .DocSearch, .VPNavBarSearch .VPNavBarSearchButton) {
  margin: 0;
}

.pn-docs-search {
  display: inline-flex;
  align-items: center;
}

.pn-docs-search .VPNavBarSearchButton {
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgb(var(--pn-accent-rgb) / 0.18);
  background: rgb(var(--pn-accent-rgb) / 0.06);
}

.pn-docs-search .VPNavBarSearchButton:hover {
  background: rgb(var(--pn-accent-rgb) / 0.1);
}
</style>
