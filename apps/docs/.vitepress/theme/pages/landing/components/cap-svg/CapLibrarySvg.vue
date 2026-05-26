<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>
<template>
  <svg class="cap-svg" :class="{ 'is-active': active }" viewBox="0 0 960 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="24" y="24" width="912" height="252" rx="18" class="panel" />
    <g class="shelf">
      <rect x="88" y="72" width="180" height="70" rx="12" />
      <rect x="290" y="72" width="180" height="70" rx="12" />
      <rect x="492" y="72" width="180" height="70" rx="12" />
      <rect x="694" y="72" width="180" height="70" rx="12" />
      <rect x="88" y="160" width="260" height="70" rx="12" />
      <rect x="370" y="160" width="240" height="70" rx="12" />
      <rect x="632" y="160" width="242" height="70" rx="12" />
    </g>
    <g class="scan">
      <rect x="74" y="65" width="14" height="176" rx="6" />
      <rect x="874" y="65" width="14" height="176" rx="6" />
    </g>
  </svg>
</template>
<style scoped>
.cap-svg { width: 100%; height: 126px; display: block; --acc: rgb(var(--pn-accent-rgb)); --blue: rgb(var(--pn-blue-rgb)); }
.panel { fill: color-mix(in srgb, var(--pn-bg) 72%, rgb(var(--pn-blue-rgb) / 0.16)); stroke: color-mix(in srgb, var(--pn-border) 70%, rgb(var(--pn-accent-rgb) / 0.2)); }
.shelf rect { fill: color-mix(in srgb, var(--pn-bg) 58%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.scan rect { fill: color-mix(in srgb, var(--blue) 40%, var(--acc)); opacity: .6; }
.is-active .scan rect:first-child { animation: lib-scan-l 3.4s ease-in-out infinite; }
.is-active .scan rect:last-child { animation: lib-scan-r 3.4s ease-in-out infinite; }
.is-active .shelf rect { animation: lib-breathe 2.6s ease-in-out infinite; }
.is-active .shelf rect:nth-child(3n) { animation-delay: .2s; }
.is-active .shelf rect:nth-child(3n+1) { animation-delay: .45s; }
@keyframes lib-scan-l { 0%,100% { transform: translateX(0); } 50% { transform: translateX(740px); } }
@keyframes lib-scan-r { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-740px); } }
@keyframes lib-breathe { 0%,100% { opacity: .82; } 50% { opacity: 1; } }
</style>
