// Word familiarity colouring. Two selectable modes (toggle in the top bar):
//   • "seen"    — red→green by how often you've encountered the word
//                 (grows slowly; capped high so a few reloads barely move it)
//   • "studied" — red→green by spaced-repetition maturity of the word's card(s)
//                 (only words that are in a study deck are coloured)
// In BOTH modes, words that are in a study deck get a distinct deck marker.
//
// Sightings are always recorded (per the seen policy) so the "seen" data exists
// regardless of the active colouring mode.

import { api } from './api.js';
import { store } from './store.js';
import { el } from './dom.js';

const SEEN_CAP = 30; // sightings needed to reach full green in "seen" mode

const seenCounts = new Map();  // key -> sighting count
const studyLevels = new Map(); // key -> SRS maturity 0..1 (presence = in a deck)
const seenLoaded = new Set();
const studyLoaded = new Set();
let currentPolicy = 'viewport-once-v1';
let mode = localStorage.getItem('ls_color_mode') || 'studied';

const keyOf = (lang, wlc) => `${lang}::${wlc}`;

// --- colours --------------------------------------------------------------
function bg(hue) {
  const a = document.documentElement.getAttribute('data-theme') === 'light' ? 0.28 : 0.34;
  return `hsl(${hue} 75% 50% / ${a})`;
}
const colorSeen = (count) => bg(Math.round((Math.min(count, SEEN_CAP) / SEEN_CAP) * 120));
const colorLevel = (lvl) => bg(Math.round(Math.min(Math.max(lvl, 0), 1) * 120));

function applyColor(elm) {
  const lang = elm.getAttribute('data-lang');
  const wlc = elm.dataset.w;
  if (!lang || wlc == null) return;
  const key = keyOf(lang, wlc);

  // 'off' = no colouring or markers at all.
  if (mode === 'off') {
    elm.style.removeProperty('--seen-bg');
    elm.classList.remove('in-deck');
    return;
  }

  elm.classList.toggle('in-deck', studyLevels.has(key)); // deck marker (both modes)

  let color = null;
  if (mode === 'studied') {
    if (studyLevels.has(key)) color = colorLevel(studyLevels.get(key));
  } else {
    const c = seenCounts.get(key) || 0;
    if (c > 0) color = colorSeen(c);
  }
  if (color) elm.style.setProperty('--seen-bg', color);
  else elm.style.removeProperty('--seen-bg');
}
function recolorAll() { document.querySelectorAll('.w').forEach(applyColor); }
function recolorLang(lang) {
  document.querySelectorAll(`.w[data-lang="${CSS.escape(lang)}"]`).forEach(applyColor);
}

// --- loading --------------------------------------------------------------
async function loadStudy(lang) {
  if (studyLoaded.has(lang) || !store.user) return;
  studyLoaded.add(lang);
  try {
    const { familiarity } = await api.familiarity(lang);
    for (const [w, l] of Object.entries(familiarity)) studyLevels.set(keyOf(lang, w), l);
    recolorLang(lang);
  } catch { studyLoaded.delete(lang); }
}
async function loadSeen(lang) {
  if (seenLoaded.has(lang) || !store.user) return;
  seenLoaded.add(lang);
  try {
    const { seen, policy } = await api.seenMap(lang);
    if (policy) currentPolicy = policy;
    for (const [w, c] of Object.entries(seen)) seenCounts.set(keyOf(lang, w), c);
    recolorLang(lang);
  } catch { seenLoaded.delete(lang); }
}
function ensureLoaded(lang) {
  loadStudy(lang);              // always (deck marker + studied colour)
  if (mode === 'seen') loadSeen(lang);
}

// --- sighting recording ---------------------------------------------------
const pending = new Set();
let flushTimer = null;
function scheduleFlush() { if (!flushTimer) flushTimer = setTimeout(flush, 1200); }
async function flush() {
  flushTimer = null;
  if (!pending.size) return;
  const byLang = {};
  for (const key of pending) { const [lang, wlc] = key.split('::'); (byLang[lang] ||= []).push(wlc); }
  pending.clear();
  for (const [lang, words] of Object.entries(byLang)) {
    try { await api.recordSeen({ lang, words, policy: currentPolicy }); } catch { /* ignore */ }
  }
}
function markSeen(lang, wlc) {
  const key = keyOf(lang, wlc);
  if (pending.has(key)) return;
  pending.add(key);
  seenCounts.set(key, (seenCounts.get(key) || 0) + 1);
  if (mode === 'seen') recolorLang(lang);
  scheduleFlush();
}

const observer = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer.unobserve(e.target);
        if (e.target.dataset.seenCounted) continue;
        e.target.dataset.seenCounted = '1';
        markSeen(e.target.getAttribute('data-lang'), e.target.dataset.w);
      }
    }, { threshold: 0.5 })
  : null;

// --- public API -----------------------------------------------------------
export function registerSeen(elm, word, lang) {
  const wlc = word.toLowerCase();
  elm.dataset.w = wlc;
  ensureLoaded(lang);
  applyColor(elm);
  if (currentPolicy === 'render-v1') markSeen(lang, wlc);
  else if (currentPolicy === 'click-v1') elm.addEventListener('click', () => markSeen(lang, wlc));
  else if (observer) observer.observe(elm);
}

// Called after a word is added to a deck, so it's marked in-deck immediately.
export function noteCardAdded(lang, word) {
  studyLevels.set(keyOf(lang, word.toLowerCase()), 0);
  recolorLang(lang);
}

// A top-bar toggle button to switch colouring mode.
export function colorModeToggle() {
  const NEXT = { studied: 'seen', seen: 'off', off: 'studied' };
  const label = () => (mode === 'studied' ? '🎴 Studied' : mode === 'seen' ? '👁 Seen' : '⚪ Off');
  const btn = el('button', { class: 'btn secondary small', title: 'Colour words by study progress, by how often seen, or turn colouring off' }, label());
  btn.addEventListener('click', () => {
    mode = NEXT[mode] || 'studied';
    localStorage.setItem('ls_color_mode', mode);
    btn.textContent = label();
    if (mode !== 'off') {
      // Make sure the data the new mode needs is loaded for on-screen languages.
      new Set([...document.querySelectorAll('.w[data-lang]')].map((w) => w.getAttribute('data-lang')))
        .forEach((lang) => ensureLoaded(lang));
    }
    recolorAll();
  });
  return btn;
}

// Reset when the signed-in user changes.
let lastUser = store.user?.id ?? null;
store.subscribe((s) => {
  const uid = s.user?.id ?? null;
  if (uid !== lastUser) {
    lastUser = uid;
    seenCounts.clear(); studyLevels.clear(); seenLoaded.clear(); studyLoaded.clear();
    document.querySelectorAll('.w').forEach((elm) => {
      elm.style.removeProperty('--seen-bg');
      elm.classList.remove('in-deck');
    });
  }
});
