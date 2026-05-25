<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { computed } from 'vue'
import { useData } from 'vitepress'
import LandingPage from './pages/landing/LandingPage.vue'

const { frontmatter, page } = useData()

const isLanding = computed(() => {
  // Home page only
  return page.value.relativePath === 'index.md' || frontmatter.value.pageType === 'landing'
})
</script>

<template>
  <LandingPage v-if="isLanding" />
  <DefaultTheme.Layout v-else />
</template>
