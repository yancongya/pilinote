<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <svg class="cap-svg" :class="{ 'is-active': active }" viewBox="0 0 960 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="24" y="24" width="912" height="252" rx="18" class="panel" />

    <g class="grid">
      <line v-for="x in [120,190,260,330,400,470,540,610,680,750,820]" :key="`x-${x}`" :x1="x" y1="54" :x2="x" y2="246" />
      <line v-for="y in [82,110,138,166,194,222]" :key="`y-${y}`" x1="76" :y1="y" x2="884" :y2="y" />
    </g>

    <rect x="402" y="102" width="156" height="96" rx="16" class="db" />

    <g class="rings">
      <circle cx="480" cy="150" r="70" />
      <circle cx="480" cy="150" r="102" />
    </g>

    <g class="sat">
      <circle cx="310" cy="150" r="12" />
      <circle cx="650" cy="150" r="12" />
      <circle cx="480" cy="72" r="12" />
      <circle cx="480" cy="228" r="12" />
    </g>

    <g class="links">
      <line x1="322" y1="150" x2="402" y2="150" />
      <line x1="558" y1="150" x2="638" y2="150" />
      <line x1="480" y1="84" x2="480" y2="102" />
      <line x1="480" y1="198" x2="480" y2="216" />
    </g>

    <path id="cap-local-ring-a" fill="none" stroke="none" d="M378 150 A102 102 0 1 0 582 150 A102 102 0 1 0 378 150" />
    <path id="cap-local-ring-b" fill="none" stroke="none" d="M410 150 A70 70 0 1 0 550 150 A70 70 0 1 0 410 150" />
    <g class="sync-packets">
      <circle class="p p1" cx="0" cy="0" r="6">
        <animateMotion dur="2.8s" repeatCount="indefinite"><mpath href="#cap-local-ring-a" /></animateMotion>
      </circle>
      <circle class="p p2" cx="0" cy="0" r="5">
        <animateMotion begin=".45s" dur="2.1s" repeatCount="indefinite"><mpath href="#cap-local-ring-b" /></animateMotion>
      </circle>
      <circle class="p p3" cx="0" cy="0" r="4.5">
        <animateMotion begin=".9s" dur="2.8s" repeatCount="indefinite"><mpath href="#cap-local-ring-a" /></animateMotion>
      </circle>
    </g>
  </svg>
</template>

<style scoped>
.cap-svg { width: 100%; height: 126px; display: block; --acc: rgb(var(--pn-accent-rgb)); --blue: rgb(var(--pn-blue-rgb)); }
.panel { fill: color-mix(in srgb, var(--pn-bg) 72%, rgb(var(--pn-blue-rgb) / 0.16)); stroke: color-mix(in srgb, var(--pn-border) 70%, rgb(var(--pn-accent-rgb) / 0.2)); }
.grid line { stroke: color-mix(in srgb, var(--pn-fg) 8%, transparent); stroke-width: 1; }
.db { fill: color-mix(in srgb, var(--pn-bg) 58%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.rings circle { fill: none; stroke: color-mix(in srgb, var(--pn-fg) 22%, transparent); stroke-width: 2; }
.sat circle { fill: color-mix(in srgb, var(--blue) 40%, var(--acc)); }
.links line { stroke: color-mix(in srgb, var(--pn-fg) 36%, transparent); stroke-width: 2; }
.sync-packets .p { fill: color-mix(in srgb, var(--acc) 55%, var(--blue)); opacity: 0; }
.sync-packets .p1 { opacity: .9; }
.sync-packets .p2 { opacity: .85; }
.sync-packets .p3 { opacity: .75; }

.is-active .rings circle:first-child { animation: loc-ring 2.6s ease-in-out infinite; }
.is-active .rings circle:last-child { animation: loc-ring 2.6s ease-in-out .44s infinite; }
.is-active .sat circle { animation: loc-node-r 1.8s ease-in-out infinite; }
.is-active .links line { animation: loc-link 2.2s ease-in-out infinite; }

@keyframes loc-node-r { 0%,100% { r: 12; } 50% { r: 14.3; } }
@keyframes loc-ring { 0% { opacity: .15; stroke-width: 2; } 50% { opacity: .5; stroke-width: 3; } 100% { opacity: .15; stroke-width: 2; } }
@keyframes loc-link { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
</style>
