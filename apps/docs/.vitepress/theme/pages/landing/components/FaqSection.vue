<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { prefersReducedMotion } from '../../../lib/motion'
import { FAQS } from '../content'

const activeIndex = ref(0)
const answerRefs = ref<Array<HTMLElement | null>>([])
const iconRefs = ref<Array<HTMLElement | null>>([])

function setAnswerRef(el: Element | null, index: number) {
  answerRefs.value[index] = el as HTMLElement | null
}

function setIconRef(el: Element | null, index: number) {
  iconRefs.value[index] = el as HTMLElement | null
}

function runStaticLayout() {
  answerRefs.value.forEach((el, index) => {
    if (!el) return
    const isOpen = activeIndex.value === index
    el.style.height = isOpen ? 'auto' : '0px'
    el.style.opacity = isOpen ? '1' : '0'
  })
  iconRefs.value.forEach((el, index) => {
    if (!el) return
    el.style.transform = activeIndex.value === index ? 'rotate(90deg)' : 'rotate(0deg)'
  })
}

async function animateToIndex(index: number) {
  const next = activeIndex.value === index ? -1 : index
  const fromIndex = activeIndex.value
  activeIndex.value = next
  await nextTick()

  if (prefersReducedMotion()) {
    runStaticLayout()
    return
  }

  const { gsap } = await import('gsap')

  if (fromIndex >= 0 && answerRefs.value[fromIndex]) {
    const leaving = answerRefs.value[fromIndex]!
    gsap.killTweensOf(leaving)
    gsap.fromTo(
      leaving,
      { height: leaving.scrollHeight, opacity: 1 },
      { height: 0, opacity: 0, duration: 0.24, ease: 'power2.inOut' }
    )
    if (iconRefs.value[fromIndex]) {
      gsap.to(iconRefs.value[fromIndex], { rotate: 0, duration: 0.22, ease: 'power2.out' })
    }
  }

  if (next >= 0 && answerRefs.value[next]) {
    const entering = answerRefs.value[next]!
    gsap.killTweensOf(entering)
    gsap.fromTo(
      entering,
      { height: 0, opacity: 0 },
      {
        height: entering.scrollHeight,
        opacity: 1,
        duration: 0.32,
        ease: 'power2.out',
        onComplete: () => {
          entering.style.height = 'auto'
        },
      }
    )
    if (iconRefs.value[next]) {
      gsap.to(iconRefs.value[next], { rotate: 90, duration: 0.26, ease: 'power2.out' })
    }
  }
}

onMounted(() => {
  runStaticLayout()
})
</script>

<template>
  <section id="faq" class="lp2-section" data-reveal>
    <div class="lp2-container">
      <div class="lp2-section-head">
        <h2 class="lp2-h2">FAQ</h2>
        <p class="lp2-sub">常见问题与边界条件，以当前实现为准。</p>
      </div>

      <div class="lp2-faq">
        <article
          v-for="(item, index) in FAQS"
          :key="item.q"
          class="lp2-faq-item"
          :class="{ 'is-open': activeIndex === index }"
        >
          <button
            class="lp2-faq-q"
            type="button"
            :aria-expanded="activeIndex === index"
            :aria-controls="`faq-panel-${index}`"
            @click="void animateToIndex(index)"
          >
            <span ref="el => setIconRef(el, index)" class="lp2-faq-icon" aria-hidden="true">▶</span>
            <span>{{ item.q }}</span>
          </button>
          <div
            :id="`faq-panel-${index}`"
            :ref="el => setAnswerRef(el, index)"
            class="lp2-faq-a-wrap"
            role="region"
            :aria-hidden="activeIndex !== index"
          >
            <div class="lp2-faq-a">
              <p class="lp2-faq-a-text">{{ item.a }}</p>
              <div v-if="item.refs?.length" class="lp2-faq-links">
                <a
                  v-for="ref in item.refs"
                  :key="ref.url"
                  class="lp2-faq-link"
                  :href="ref.url"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ ref.label }}
                </a>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lp2-section {
  padding: 64px 0;
}

.lp2-container {
  max-width: 1200px;
  padding: 0 18px;
  margin: 0 auto;
}

.lp2-section-head {
  margin-bottom: 18px;
}

.lp2-h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
  line-height: 1.25;
}

.lp2-sub {
  margin: 0;
  color: var(--pn-muted);
  line-height: 1.6;
  font-size: 14px;
  max-width: 70ch;
}

.lp2-faq {
  display: grid;
  gap: 10px;
}

.lp2-faq-item {
  border-radius: 16px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-card) 86%, transparent);
  padding: 0;
  transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease;
}

.lp2-faq-item.is-open {
  border-color: rgb(var(--pn-accent-rgb) / 0.3);
  background:
    radial-gradient(520px 140px at 6% 0%, rgb(var(--pn-accent-rgb) / 0.08), transparent 68%),
    color-mix(in srgb, var(--pn-card) 88%, transparent);
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.08);
}

.lp2-faq-q {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 13px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  font-weight: 620;
  color: var(--pn-fg);
  font-size: 17px;
}

.lp2-faq-q:focus-visible {
  outline: 2px solid rgb(var(--pn-blue-rgb) / 0.5);
  outline-offset: -2px;
  border-radius: 16px 16px 0 0;
}

.lp2-faq-icon {
  width: 14px;
  color: color-mix(in srgb, var(--pn-fg) 72%, var(--pn-muted));
  font-size: 12px;
  line-height: 1;
  transform-origin: center;
  flex: 0 0 auto;
}

.lp2-faq-a-wrap {
  height: 0;
  opacity: 0;
  overflow: hidden;
}

.lp2-faq-a {
  padding: 0 14px 13px 36px;
  color: var(--pn-muted);
  line-height: 1.65;
  font-size: 14px;
}

.lp2-faq-a-text {
  margin: 0;
}

.lp2-faq-links {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.lp2-faq-link {
  height: 28px;
  border-radius: 999px;
  border: 1px solid var(--pn-border);
  background: color-mix(in srgb, var(--pn-bg) 72%, transparent);
  color: var(--pn-fg);
  padding: 0 10px;
  font-size: 13px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
}

.lp2-faq-link:hover {
  border-color: rgb(var(--pn-accent-rgb) / 0.35);
  background: color-mix(in srgb, rgb(var(--pn-accent-rgb) / 0.1) 50%, transparent);
  transform: translateY(-1px);
}

.lp2-faq-link:focus-visible {
  outline: 2px solid rgb(var(--pn-blue-rgb) / 0.5);
  outline-offset: 2px;
}

@media (min-width: 860px) {
  .lp2-h2 {
    font-size: 24px;
  }
}
</style>
