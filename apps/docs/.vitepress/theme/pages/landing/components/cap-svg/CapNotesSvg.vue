<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <svg class="cap-svg" :class="{ 'is-active': active }" viewBox="0 0 960 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <linearGradient id="noteLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="var(--pn-accent)" stop-opacity="0.85" />
        <stop offset="100%" stop-color="var(--pn-blue)" stop-opacity="0.85" />
      </linearGradient>
    </defs>
    <rect x="24" y="24" width="912" height="252" rx="18" class="panel" />

    <path class="timeline" d="M80 218 H880" />
    <g class="nodes">
      <circle cx="180" cy="218" r="9" />
      <circle cx="360" cy="218" r="9" />
      <circle cx="560" cy="218" r="9" />
      <circle cx="760" cy="218" r="9" />
    </g>

    <g class="notes">
      <rect x="110" y="72" width="170" height="84" rx="12" />
      <rect x="330" y="56" width="210" height="98" rx="12" />
      <rect x="600" y="80" width="220" height="90" rx="12" />
    </g>

    <path id="cap-notes-jump-path" class="jump" d="M180 218 C260 176, 300 166, 360 218 C430 266, 500 266, 560 218 C620 172, 700 172, 760 218" />
    <circle class="cursor" cx="0" cy="0" r="7">
      <animateMotion
        path="M180 218 C260 176, 300 166, 360 218 C430 266, 500 266, 560 218 C620 172, 700 172, 760 218"
        dur="3.3s"
        repeatCount="indefinite"
        keyTimes="0;0.32;0.68;1"
        keySplines="0.32 0 0.2 1;0.25 0.2 0.2 1;0.2 0 0.2 1"
        calcMode="spline"
      />
    </circle>
  </svg>
</template>

<style scoped>
.cap-svg { width: 100%; height: 126px; display: block; color: rgb(var(--pn-blue-rgb)); --pn-accent: rgb(var(--pn-accent-rgb)); --pn-blue: rgb(var(--pn-blue-rgb)); }
.panel { fill: color-mix(in srgb, var(--pn-bg) 72%, rgb(var(--pn-blue-rgb) / 0.16)); stroke: color-mix(in srgb, var(--pn-border) 70%, rgb(var(--pn-accent-rgb) / 0.2)); }
.timeline { fill: none; stroke: color-mix(in srgb, var(--pn-fg) 30%, transparent); stroke-width: 2; }
.nodes circle { fill: color-mix(in srgb, var(--pn-bg) 35%, transparent); stroke: url(#noteLine); stroke-width: 2; }
.notes rect { fill: color-mix(in srgb, var(--pn-bg) 56%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.jump { fill: none; stroke: url(#noteLine); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 8 10; stroke-dashoffset: 220; opacity: 0; }
.cursor { fill: var(--pn-accent); opacity: 0; }

.is-active .jump { opacity: 1; animation: note-jump 3.3s ease-in-out infinite; }
.is-active .cursor { opacity: 1; animation: note-cursor-pulse 1.3s ease-in-out infinite; }
.is-active .nodes circle { animation: note-pulse 2s ease-in-out infinite; }
.is-active .nodes circle:nth-child(2) { animation-delay: .24s; }
.is-active .nodes circle:nth-child(3) { animation-delay: .48s; }
.is-active .nodes circle:nth-child(4) { animation-delay: .72s; }

@keyframes note-jump { 0%{stroke-dashoffset:220} 100%{stroke-dashoffset:0} }
@keyframes note-pulse { 0%,100% { r: 9; } 50% { r: 11; } }
@keyframes note-cursor-pulse { 0%,100% { r: 7; } 50% { r: 8.5; } }
</style>
