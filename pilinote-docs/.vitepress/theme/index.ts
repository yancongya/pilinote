import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './styles/theme.css'

import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp(ctx) {
    // Keep DefaultTheme behavior.
    DefaultTheme.enhanceApp?.(ctx)
  },
} satisfies Theme
