<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>
<template>
  <svg class="cap-svg" :class="{ 'is-active': active }" viewBox="0 0 960 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="24" y="24" width="912" height="252" rx="18" class="panel" />
    <g class="row">
      <rect x="90" y="88" width="560" height="22" rx="8" /><rect x="90" y="138" width="560" height="22" rx="8" /><rect x="90" y="188" width="560" height="22" rx="8" />
    </g>
    <g class="fill">
      <rect class="f1" x="90" y="88" width="10" height="22" rx="8" />
      <rect class="f2" x="90" y="138" width="10" height="22" rx="8" />
      <rect class="f3" x="90" y="188" width="10" height="22" rx="8" />
    </g>
    <g class="disk">
      <rect x="706" y="96" width="160" height="120" rx="16" />
      <line x1="732" y1="131" x2="840" y2="131" />
      <line x1="732" y1="158" x2="840" y2="158" />
      <circle cx="824" cy="190" r="14" />
    </g>
  </svg>
</template>
<style scoped>
.cap-svg { width: 100%; height: 126px; display: block; --acc: rgb(var(--pn-accent-rgb)); --blue: rgb(var(--pn-blue-rgb)); }
.panel { fill: color-mix(in srgb, var(--pn-bg) 72%, rgb(var(--pn-blue-rgb) / 0.16)); stroke: color-mix(in srgb, var(--pn-border) 70%, rgb(var(--pn-accent-rgb) / 0.2)); }
.row rect { fill: color-mix(in srgb, var(--pn-bg) 54%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.fill rect { fill: color-mix(in srgb, var(--acc) 60%, var(--blue)); width: 0; }
.disk rect { fill: color-mix(in srgb, var(--pn-bg) 58%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.disk line { stroke: color-mix(in srgb, var(--pn-fg) 35%, transparent); stroke-width: 2; stroke-linecap: round; }
.disk circle { fill: color-mix(in srgb, var(--blue) 50%, transparent); stroke: color-mix(in srgb, var(--pn-border) 75%, transparent); }
.is-active .f1 { animation: dl 2.8s ease-in-out infinite; }
.is-active .f2 { animation: dl 2.8s ease-in-out .35s infinite; }
.is-active .f3 { animation: dl 2.8s ease-in-out .7s infinite; }
.is-active .disk circle { animation: spin 1.6s linear infinite; transform-origin: 824px 190px; }
@keyframes dl { 0% { width: 10px; } 60% { width: 420px; } 100% { width: 560px; } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
