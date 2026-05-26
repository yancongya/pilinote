<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>

<template>
  <svg class="cap-svg" :class="{ 'is-active': active }" viewBox="0 0 960 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <rect x="24" y="24" width="912" height="252" rx="18" class="panel" />
    <line x1="72" y1="230" x2="890" y2="230" class="rail" />

    <g class="cards">
      <g class="card c1"><rect x="70" y="78" width="142" height="86" rx="12" /><line x1="90" y1="108" x2="190" y2="108" /><line x1="90" y1="128" x2="170" y2="128" /></g>
      <g class="card c2"><rect x="70" y="78" width="142" height="86" rx="12" /><line x1="90" y1="108" x2="190" y2="108" /><line x1="90" y1="128" x2="170" y2="128" /></g>
      <g class="card c3"><rect x="70" y="78" width="142" height="86" rx="12" /><line x1="90" y1="108" x2="190" y2="108" /><line x1="90" y1="128" x2="170" y2="128" /></g>
      <g class="card c4"><rect x="70" y="78" width="142" height="86" rx="12" /><line x1="90" y1="108" x2="190" y2="108" /><line x1="90" y1="128" x2="170" y2="128" /></g>
      <g class="card c5"><rect x="70" y="78" width="142" height="86" rx="12" /><line x1="90" y1="108" x2="190" y2="108" /><line x1="90" y1="128" x2="170" y2="128" /></g>
    </g>

    <g class="shards">
      <rect class="s1" x="650" y="116" width="10" height="10" rx="2" />
      <rect class="s2" x="662" y="110" width="8" height="8" rx="2" />
      <rect class="s3" x="670" y="120" width="9" height="9" rx="2" />
      <rect class="s4" x="682" y="114" width="8" height="8" rx="2" />
      <rect class="s5" x="690" y="124" width="10" height="10" rx="2" />
      <rect class="s6" x="704" y="116" width="9" height="9" rx="2" />
    </g>

    <g class="assets">
      <rect x="760" y="74" width="130" height="34" rx="9" />
      <rect x="760" y="118" width="130" height="34" rx="9" />
      <rect x="760" y="162" width="130" height="34" rx="9" />
      <text x="775" y="96">note.md</text>
      <text x="775" y="140">subtitle.srt</text>
      <text x="775" y="184">video.nfo</text>
    </g>
  </svg>
</template>

<style scoped>
.cap-svg { width: 100%; height: 126px; display: block; --acc: rgb(var(--pn-accent-rgb)); --blue: rgb(var(--pn-blue-rgb)); }
.panel { fill: color-mix(in srgb, var(--pn-bg) 72%, rgb(var(--pn-blue-rgb) / 0.16)); stroke: color-mix(in srgb, var(--pn-border) 70%, rgb(var(--pn-accent-rgb) / 0.2)); }
.rail { stroke: color-mix(in srgb, var(--pn-fg) 30%, transparent); stroke-width: 2; }
.card rect { fill: color-mix(in srgb, var(--pn-bg) 58%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.card line { stroke: color-mix(in srgb, var(--pn-fg) 35%, transparent); stroke-width: 2; stroke-linecap: round; }
.assets rect { fill: color-mix(in srgb, var(--pn-bg) 45%, transparent); stroke: color-mix(in srgb, var(--pn-border) 80%, transparent); }
.assets text { fill: color-mix(in srgb, var(--pn-fg) 78%, transparent); font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
.shards rect { fill: var(--acc); opacity: 0; transform-origin: center; }

.is-active .c1 { animation: q-move 4.8s ease-in-out infinite; }
.is-active .c2 { animation: q-move 4.8s ease-in-out .32s infinite; }
.is-active .c3 { animation: q-move 4.8s ease-in-out .64s infinite; }
.is-active .c4 { animation: q-move 4.8s ease-in-out .96s infinite; }
.is-active .c5 { animation: q-move 4.8s ease-in-out 1.28s infinite; }
.is-active .s1 { animation: q-shard 1.2s ease-out 2.15s infinite; }
.is-active .s2 { animation: q-shard 1.2s ease-out 2.2s infinite; }
.is-active .s3 { animation: q-shard 1.2s ease-out 2.26s infinite; }
.is-active .s4 { animation: q-shard 1.2s ease-out 2.3s infinite; }
.is-active .s5 { animation: q-shard 1.2s ease-out 2.36s infinite; }
.is-active .s6 { animation: q-shard 1.2s ease-out 2.42s infinite; }

@keyframes q-move {
  0% { opacity: 0; transform: translateX(0) scale(.92); }
  12% { opacity: 1; transform: translateX(40px) scale(1); }
  50% { opacity: 1; transform: translateX(470px) scale(1); }
  70% { opacity: .8; transform: translateX(560px) scale(1.02) rotate(2deg); }
  100% { opacity: 0; transform: translateX(620px) scale(.2) rotate(10deg); }
}
@keyframes q-shard {
  0% { opacity: 0; transform: translate(0,0) scale(.2); }
  30% { opacity: .95; }
  100% { opacity: 0; transform: translate(34px, -18px) scale(1) rotate(30deg); }
}
</style>
