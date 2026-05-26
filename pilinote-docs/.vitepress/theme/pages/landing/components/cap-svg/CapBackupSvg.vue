<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>
<template>
  <svg class="cap-svg" :class="{ 'is-active': active }" viewBox="0 0 960 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="24" y="24" width="912" height="252" rx="18" class="panel" />
    <rect x="120" y="94" width="180" height="110" rx="16" class="left" />
    <rect x="660" y="94" width="180" height="110" rx="16" class="right" />
    <g class="pipe">
      <path d="M300 130 C410 130, 430 110, 480 110 C530 110, 550 130, 660 130" />
      <path d="M300 170 C410 170, 430 190, 480 190 C530 190, 550 170, 660 170" />
    </g>
    <g class="packets">
      <circle class="p1" cx="300" cy="130" r="6" />
      <circle class="p2" cx="300" cy="170" r="6" />
      <circle class="p3" cx="660" cy="170" r="6" />
      <circle class="p4" cx="660" cy="130" r="6" />
    </g>
  </svg>
</template>
<style scoped>
.cap-svg { width: 100%; height: 126px; display: block; --acc: rgb(var(--pn-accent-rgb)); --blue: rgb(var(--pn-blue-rgb)); }
.panel { fill: color-mix(in srgb, var(--pn-bg) 72%, rgb(var(--pn-blue-rgb) / 0.16)); stroke: color-mix(in srgb, var(--pn-border) 70%, rgb(var(--pn-accent-rgb) / 0.2)); }
.left,.right { fill: color-mix(in srgb, var(--pn-bg) 58%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.pipe path { fill: none; stroke: color-mix(in srgb, var(--pn-fg) 35%, transparent); stroke-width: 2.2; stroke-dasharray: 8 8; }
.packets circle { fill: color-mix(in srgb, var(--acc) 55%, var(--blue)); opacity: 0; }
.is-active .pipe path { animation: bk-dash 2.2s linear infinite; }
.is-active .p1 { opacity: 1; animation: bk-lr-top 2.8s ease-in-out infinite; }
.is-active .p2 { opacity: 1; animation: bk-lr-btm 2.8s ease-in-out .4s infinite; }
.is-active .p3 { opacity: 1; animation: bk-rl-btm 2.8s ease-in-out .8s infinite; }
.is-active .p4 { opacity: 1; animation: bk-rl-top 2.8s ease-in-out 1.2s infinite; }
@keyframes bk-dash { to { stroke-dashoffset: -64; } }
@keyframes bk-lr-top { to { transform: translateX(360px); } }
@keyframes bk-lr-btm { to { transform: translateX(360px); } }
@keyframes bk-rl-top { to { transform: translateX(-360px); } }
@keyframes bk-rl-btm { to { transform: translateX(-360px); } }
</style>
