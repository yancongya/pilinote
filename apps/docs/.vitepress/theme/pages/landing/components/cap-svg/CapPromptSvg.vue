<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>
<template>
  <svg class="cap-svg" :class="{ 'is-active': active }" viewBox="0 0 960 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="24" y="24" width="912" height="252" rx="18" class="panel" />
    <g class="nodes">
      <rect x="90" y="122" width="160" height="56" rx="14" />
      <rect x="330" y="72" width="180" height="56" rx="14" />
      <rect x="330" y="172" width="180" height="56" rx="14" />
      <rect x="600" y="122" width="220" height="56" rx="14" />
    </g>
    <g class="links">
      <path d="M250 150 C292 150, 296 100, 330 100" />
      <path d="M250 150 C292 150, 296 200, 330 200" />
      <path d="M510 100 C552 100, 560 150, 600 150" />
      <path d="M510 200 C552 200, 560 150, 600 150" />
    </g>
    <path id="cap-prompt-flow-top" fill="none" stroke="none" d="M250 150 C292 150, 296 100, 330 100 C552 100, 560 150, 600 150" />
    <path id="cap-prompt-flow-bottom" fill="none" stroke="none" d="M250 150 C292 150, 296 200, 330 200 C552 200, 560 150, 600 150" />
    <circle class="token t1" cx="0" cy="0" r="6">
      <animateMotion dur="2.4s" repeatCount="indefinite" keyTimes="0;1" keySplines="0.22 0 0.2 1" calcMode="spline">
        <mpath href="#cap-prompt-flow-top" />
      </animateMotion>
    </circle>
    <circle class="token t2" cx="0" cy="0" r="6">
      <animateMotion begin="0.7s" dur="2.4s" repeatCount="indefinite" keyTimes="0;1" keySplines="0.22 0 0.2 1" calcMode="spline">
        <mpath href="#cap-prompt-flow-bottom" />
      </animateMotion>
    </circle>
  </svg>
</template>
<style scoped>
.cap-svg { width: 100%; height: 126px; display: block; --acc: rgb(var(--pn-accent-rgb)); --blue: rgb(var(--pn-blue-rgb)); }
.panel { fill: color-mix(in srgb, var(--pn-bg) 72%, rgb(var(--pn-blue-rgb) / 0.16)); stroke: color-mix(in srgb, var(--pn-border) 70%, rgb(var(--pn-accent-rgb) / 0.2)); }
.nodes rect { fill: color-mix(in srgb, var(--pn-bg) 58%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.links path { fill: none; stroke: color-mix(in srgb, var(--pn-fg) 38%, transparent); stroke-width: 2.3; stroke-linecap: round; stroke-dasharray: 6 8; }
.token { fill: color-mix(in srgb, var(--acc) 55%, var(--blue)); opacity: 0; }
.is-active .links path { animation: prm-dash 2.2s linear infinite; }
.is-active .t1 { opacity: 1; animation: prm-dot 1.2s ease-in-out infinite; }
.is-active .t2 { opacity: 1; animation: prm-dot 1.2s ease-in-out .2s infinite; }
@keyframes prm-dash { to { stroke-dashoffset: -70; } }
@keyframes prm-dot { 0%,100% { r: 6; } 50% { r: 7.3; } }
</style>
