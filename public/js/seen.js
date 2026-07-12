// Familiarity tracking: colours each word from red (never seen) to green (seen
// many times), and records "seen" events per the current policy.
//
// The policy (what counts as "seen") is fetched from the server and is
// deliberately swappable — see server/lib/seenPolicy.js. Supported client
// triggers: viewport-once-v1 (word scrolls into view), click-v1 (word clicked),
// render-v1 (word rendered at all).

import { api } from './api.js';
import { store } from './store.js';

const CAP = 8; // seen_count at which a word is fully "green"
const counts = new Map();   // `${lang}::${wlc}` -> seen_count
const loaded = new Set();   // languages whose seen-map has been fetched
let currentPolicy = 'viewport-once-v1';

// --- colouring ------------------------------------------------------------
// A translucent highlight behind the word: red (never seen) -> green (seen a lot).
function colorFor(count) {
  const t = Math.min(count, CAP) / CAP;      // 0..1
  const hue = Math.round(t * 120);           // 0 = red, 120 = green
  const alpha = document.documentElement.getAttribute('data-theme') === 'light' ? 0.28 : 0.34;
  return `hsl(${hue} 75% 50% / ${alpha})`;
}
function keyOf(lang, wlc) { return `${lang}::${wlc}`; }
function applyColor(elm, lang, wlc) {
  elm.style.setProperty('--seen-bg', colorFor(counts.get(keyOf(lang, wlc)) || 0));
}
function recolor(lang, wlc) {
  const sel = `.w[data-lang="${CSS.escape(lang)}"][data-w="${CSS.escape(wlc)}"]`;
  document.querySelectorAll(sel).forEach((elm) => applyColor(elm, lang, wlc));
}
function recolorLang(lang) {
  document.querySelectorAll(`.w[data-lang="${CSS.escape(lang)}"]`).forEach((elm) => {
    if (elm.dataset.w) applyColor(elm, lang, elm.dataset.w);
  });
}

// --- recording ------------------------------------------------------------
const pending = new Set(); // keys queued for the next flush (dedup per window)
let flushTimer = null;
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 1200);
}
async function flush() {
  flushTimer = null;
  if (!pending.size) return;
  const byLang = {};
  for (const key of pending) {
    const [lang, wlc] = key.split('::');
    (byLang[lang] ||= []).push(wlc);
  }
  pending.clear();
  for (const [lang, words] of Object.entries(byLang)) {
    try { await api.recordSeen({ lang, words, policy: currentPolicy }); } catch { /* ignore */ }
  }
}
function markSeen(lang, wlc) {
  const key = keyOf(lang, wlc);
  if (pending.has(key)) return;            // count each word once per flush window
  pending.add(key);
  counts.set(key, (counts.get(key) || 0) + 1);
  recolor(lang, wlc);
  scheduleFlush();
}

// --- observer (viewport policy) -------------------------------------------
const observer = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const elm = e.target;
        observer.unobserve(elm);
        if (elm.dataset.seenCounted) continue;
        elm.dataset.seenCounted = '1';
        markSeen(elm.getAttribute('data-lang'), elm.dataset.w);
      }
    }, { threshold: 0.5 })
  : null;

// --- public: called from render.js for every word element -----------------
export function registerSeen(elm, word, lang) {
  const wlc = word.toLowerCase();
  elm.dataset.w = wlc;
  applyColor(elm, lang, wlc);
  ensureLoaded(lang);

  if (currentPolicy === 'render-v1') {
    markSeen(lang, wlc);
  } else if (currentPolicy === 'click-v1') {
    elm.addEventListener('click', () => markSeen(lang, wlc));
  } else if (observer) {
    observer.observe(elm);
  }
}

async function ensureLoaded(lang) {
  if (loaded.has(lang) || !store.user) return;
  loaded.add(lang);
  try {
    const { seen, policy } = await api.seenMap(lang);
    if (policy) currentPolicy = policy;
    for (const [wlc, c] of Object.entries(seen)) counts.set(keyOf(lang, wlc), c);
    recolorLang(lang);
  } catch { loaded.delete(lang); }
}

// Reset when the signed-in user changes (login/logout).
let lastUser = store.user?.id ?? null;
store.subscribe((s) => {
  const uid = s.user?.id ?? null;
  if (uid !== lastUser) {
    lastUser = uid;
    counts.clear();
    loaded.clear();
    document.querySelectorAll('.w').forEach((elm) => elm.style.removeProperty('--seen-bg'));
  }
});
