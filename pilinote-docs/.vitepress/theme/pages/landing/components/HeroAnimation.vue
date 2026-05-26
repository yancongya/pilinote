<template>
  <div class="hp-anim" aria-hidden="true">
    <svg class="hp-svg" viewBox="0 0 560 420" role="img" aria-label="PiliNote 工作流动画示意">
      <defs>
        <linearGradient id="hp-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgb(var(--pn-accent-rgb))" stop-opacity="0.9" />
          <stop offset="1" stop-color="rgb(var(--pn-accent2-rgb))" stop-opacity="0.85" />
        </linearGradient>
        <filter id="hp-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.28 0"
            result="c"
          />
          <feMerge>
            <feMergeNode in="c" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- connectors (behind cards, routed through gutters) -->
      <g class="hp-connectors">
        <path
          class="hp-rail"
          d="M282 176
             C302 176 316 176 336 176
             M210 260
             C230 260 246 260 268 260
             M282 260
             C302 260 316 260 336 260
             M282 212
             C282 230 282 242 282 248
             M372 212
             C372 230 372 242 372 248"
        />
      </g>

      <!-- cards -->
      <g class="hp-cards" aria-label="流程卡片">
        <g class="hp-card hp-card--sync" transform="translate(96 134)">
          <rect class="hp-card-bg" width="186" height="92" rx="18" />
          <text class="hp-card-sub" x="16" y="28">收藏夹 / 稍后再看 / 历史 / 订阅</text>
          <text class="hp-card-txt" x="16" y="62">同步列表</text>
          <text class="hp-card-meta" x="16" y="80">增量 · 去重 · 分页</text>
        </g>

        <g class="hp-card hp-card--queue" transform="translate(278 134)">
          <rect class="hp-card-bg" width="186" height="92" rx="18" />
          <text class="hp-card-sub" x="16" y="28">速率控制 / 并发 / 重试</text>
          <text class="hp-card-txt" x="16" y="62">队列调度</text>
          <text class="hp-card-meta" x="16" y="80">可控节奏</text>
        </g>

        <g class="hp-card hp-card--disk" transform="translate(96 238)">
          <rect class="hp-card-bg" width="186" height="92" rx="18" />
          <text class="hp-card-sub" x="16" y="28">字幕 / NFO / 截图 / AI 笔记</text>
          <text class="hp-card-txt" x="16" y="62">sidecar 落盘</text>
          <text class="hp-card-meta" x="16" y="80">同级归档</text>
        </g>

        <g class="hp-card hp-card--jump" transform="translate(278 238)">
          <rect class="hp-card-bg" width="186" height="92" rx="18" />
          <text class="hp-card-sub" x="16" y="28">时间戳 → 播放进度</text>
          <text class="hp-card-txt" x="16" y="62">回跳复习</text>
          <text class="hp-card-meta" x="16" y="80">点击即到</text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.hp-anim {
  border-radius: 18px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 70%, rgb(var(--pn-accent-rgb) / 0.06));
  overflow: hidden;
  position: relative;
  aspect-ratio: 4 / 3;
}

.hp-anim::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(700px 300px at 20% 20%, rgb(var(--pn-accent-rgb) / 0.12), transparent 55%),
    radial-gradient(520px 240px at 85% 35%, rgb(var(--pn-accent2-rgb) / 0.1), transparent 55%);
  pointer-events: none;
}

.hp-svg {
  width: 100%;
  height: auto;
  display: block;
  position: relative;
}

.hp-connectors {
  opacity: 1;
}

.hp-rail {
  fill: none;
  stroke: url(#hp-grad);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 7 12;
  opacity: 0.22;
  animation: hp-dash 7.4s linear infinite;
}

.hp-cards {
  pointer-events: none;
}

.hp-card {
  pointer-events: all;
  cursor: default;
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 160ms ease;
}

.hp-card:hover {
  transform: translateY(-2px);
}

.hp-card-bg {
  fill: color-mix(in srgb, var(--pn-fg) 3%, transparent);
  stroke: var(--pn-border);
  stroke-width: 1;
  transition: fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease;
  filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.12));
}

.hp-card:hover .hp-card-bg {
  fill: color-mix(in srgb, var(--pn-fg) 4%, transparent);
  stroke: rgb(var(--pn-accent-rgb) / 0.42);
  stroke-width: 1.2;
}

.hp-card-txt {
  font-size: 13px;
  font-weight: 780;
  fill: var(--pn-fg);
}

.hp-card-sub {
  font-size: 9.6px;
  font-weight: 650;
  fill: color-mix(in srgb, var(--pn-muted) 86%, transparent);
}

.hp-card-meta {
  font-size: 9.8px;
  font-weight: 650;
  fill: var(--pn-muted);
  opacity: 0.9;
}

/* edge-stroke pipeline animation (no dot nodes) */
@keyframes hp-edge {
  0%,
  60%,
  100% {
    stroke: var(--pn-border);
  }
  15%,
  45% {
    stroke: rgb(var(--pn-accent-rgb) / 0.55);
  }
}

.hp-card .hp-card-bg {
  animation: hp-edge 3.2s ease-in-out infinite;
}
.hp-card--queue .hp-card-bg {
  animation-delay: 0.25s;
}
.hp-card--disk .hp-card-bg {
  animation-delay: 0.5s;
}
.hp-card--jump .hp-card-bg {
  animation-delay: 0.75s;
}

@keyframes hp-dash {
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: -240;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hp-rail,
  .hp-card .hp-card-bg {
    animation: none !important;
  }
}
</style>

