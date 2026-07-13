// App bootstrap: loads languages + current user, renders the sidebar and auth
// area, then starts the router. Re-renders reactive bits when auth changes.

import { api } from './api.js';
import { store } from './store.js';
import { el, clear, openModal } from './dom.js';
import { tokenizeTree } from './render.js';
import { loadCurrentUser, renderAuthArea } from './auth.js';
import { startRouter } from './router.js';
import { guardSingleInstance } from './singleInstance.js';

// Make the persistent chrome (language bar, top-bar labels) clickable too.
function tokenizeChrome() {
  tokenizeTree(document.querySelector('.lang-viewport'));
  tokenizeTree(document.getElementById('auth-area'));
}

function reloadLanguages() {
  return api.languages().then(({ languages }) => store.set({ languages })).catch(() => {});
}

// Show a badge with total due cards on the Flashcards nav item.
async function updateDueBadge() {
  const link = document.querySelector('.topnav a[href="#/decks"]');
  if (!link) return;
  const clearBadges = () => link.querySelectorAll('.due-badge').forEach((b) => b.remove());
  if (!store.user) { clearBadges(); return; }
  try {
    const { decks } = await api.decks();
    const due = decks.reduce((s, d) => s + (d.due || 0), 0);
    clearBadges(); // remove AFTER the await, so concurrent calls can't double-append
    if (due > 0) link.append(el('span', { class: 'due-badge' }, String(due)));
  } catch { /* ignore */ }
}
window.addEventListener('ls:decks-changed', updateDueBadge);

// Top-bar word search.
function setupSearch() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) window.location.hash = `#/search/${encodeURIComponent(q)}`;
  });
}

// Language carousel: prev/next arrows scroll the horizontal viewport. Arrows
// hide when there's nothing to scroll and disable at each end.
let refreshLangArrows = () => {};
function setupLangCarousel() {
  const view = document.querySelector('.lang-viewport');
  const prev = document.getElementById('lang-prev');
  const next = document.getElementById('lang-next');
  if (!view || !prev || !next) return;

  const update = () => {
    const overflow = view.scrollWidth - view.clientWidth;
    const scrollable = overflow > 4;
    prev.hidden = next.hidden = !scrollable;
    if (!scrollable) return;
    prev.disabled = view.scrollLeft <= 2;
    next.disabled = view.scrollLeft >= overflow - 2;
  };
  refreshLangArrows = update;

  const page = (dir) => view.scrollBy({ left: dir * view.clientWidth * 0.8, behavior: 'smooth' });
  prev.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  view.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// Rough global importance (by number of speakers) for the base language, so the
// long tail of not-yet-learned languages leads with the major ones; anything
// unranked falls back to alphabetical by name.
const LANG_IMPORTANCE = [
  'en', 'zh', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'ru', 'ur', 'id', 'de', 'ja',
  'sw', 'tr', 'ta', 'vi', 'ko', 'it', 'fa', 'pl', 'uk', 'th', 'nl', 'ms', 'ro',
  'el', 'cs', 'sv', 'hu', 'he', 'da', 'fi', 'sk', 'nb', 'no', 'hr', 'bg', 'sr',
  'ca', 'lt', 'sl', 'lv', 'et', 'ga', 'is', 'af', 'tl',
];
function langImportance(lang) {
  const i = LANG_IMPORTANCE.indexOf(lang.lang);
  return i < 0 ? LANG_IMPORTANCE.length : i;
}
function byImportance(a, b) {
  return langImportance(a) - langImportance(b) || a.name.localeCompare(b.name);
}

function renderSidebar() {
  const nav = clear(document.getElementById('language-list'));
  const currentCode = decodeURIComponent((window.location.hash.match(/#\/lang\/([^/]+)/) || [])[1] || '');

  const learning = store.languages.filter((l) => store.isLearning(l.code)).sort(byImportance);
  const rest = store.languages.filter((l) => !store.isLearning(l.code)).sort(byImportance);

  const makePill = (lang, isLearning) => {
    const row = el('div', { class: `lang-row${isLearning ? '' : ' not-learning'}` }, [
      el('a', {
        href: `#/lang/${lang.code}`,
        class: lang.code === currentCode ? 'active' : '',
        title: isLearning ? lang.name : `Add ${lang.name} to your languages`,
        // Clicking a not-yet-learned language adds it (then navigation proceeds).
        onclick: isLearning ? null : () => store.addLearning(lang.code),
      }, lang.name),
    ]);
    if (lang.code === store.nativeLang) {
      row.append(el('span', { class: 'lang-native-tag', title: 'Your native language' }, 'native'));
    }
    if (isLearning) {
      row.append(el('button', {
        class: 'lang-remove', title: `Remove ${lang.name} from your languages`,
        onclick: (e) => { e.preventDefault(); store.removeLearning(lang.code); },
      }, '×'));
    }
    return row;
  };

  if (!store.languages.length) nav.append(el('span', { class: 'muted' }, 'No languages yet.'));
  for (const lang of learning) nav.append(makePill(lang, true));
  if (learning.length && rest.length) nav.append(el('span', { class: 'lang-divider', 'aria-hidden': 'true' }));
  for (const lang of rest) nav.append(makePill(lang, false));
  if (store.user) {
    nav.append(el('button', { class: 'lang-add', onclick: openAddLanguage }, '+ Add language'));
  }
  refreshLangArrows();
}

function confirmRemoveLanguage(lang) {
  const err = el('div', { class: 'error' });
  const close = openModal(el('div', {}, [
    el('h2', {}, `Remove ${lang.name}?`),
    el('p', { class: 'muted' }, 'This permanently deletes all of its words, cards, tips and messages.'),
    err,
    el('div', { class: 'row', style: 'justify-content:flex-end; margin-top:1rem' }, [
      el('button', { class: 'btn small secondary', type: 'button', onclick: () => close() }, 'Cancel'),
      el('button', {
        class: 'btn small danger', type: 'button',
        onclick: async () => {
          err.textContent = '';
          try {
            await api.deleteLanguage(lang.code);
            await reloadLanguages();
            renderSidebar();
            if ((window.location.hash || '').startsWith(`#/lang/${lang.code}`)) {
              window.location.hash = store.languages[0] ? `#/lang/${store.languages[0].code}` : '#/';
            }
            close();
          } catch (ex) {
            err.textContent = ex.message;
          }
        },
      }, 'Remove'),
    ]),
  ]));
}

function openAddLanguage() {
  const err = el('div', { class: 'error' });
  const name = el('input', { type: 'text', placeholder: 'e.g. French (France)' });
  const code = el('input', { type: 'text', placeholder: 'locale code, e.g. fr-FR' });
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const c = code.value.trim();
      if (!c || !name.value.trim()) { err.textContent = 'Name and code are required'; return; }
      const base = c.split('-')[0].toLowerCase();
      const country = (c.split('-')[1] || '').toUpperCase() || null;
      try {
        await api.createLanguage({ code: c, lang: base, country, name: name.value.trim() });
        await reloadLanguages();
        store.addLearning(c);
        renderSidebar();
        close();
        window.location.hash = `#/lang/${c}`;
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [
    el('label', {}, 'Name'), name,
    el('label', {}, 'Locale code'), code,
    el('div', { class: 'muted', style: 'font-size:0.78rem; margin-top:0.3rem' }, 'Language + country, e.g. fr-FR, it-IT, ja-JP.'),
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Add language')]),
  ]);
  const close = openModal(el('div', {}, [el('h2', {}, 'Add a language'), form]));
}

async function init() {
  // Refuse to run in a second window of the same browser (avoids World collisions).
  if (!(await guardSingleInstance())) return;

  // Load languages + user in parallel.
  const [langsResult] = await Promise.allSettled([api.languages(), loadCurrentUser()]);
  if (langsResult.status === 'fulfilled') {
    store.set({ languages: langsResult.value.languages });
  }

  renderSidebar();
  renderAuthArea();
  tokenizeChrome();
  setupLangCarousel();
  setupSearch();
  startRouter();
  updateDueBadge();

  // Highlight the active top-nav item.
  const syncNav = () => {
    const h = window.location.hash || '';
    document.querySelectorAll('.topnav a').forEach((a) => {
      const target = a.getAttribute('href');
      a.classList.toggle('active', h === target || (target !== '#/' && h.startsWith(target)));
    });
  };
  syncNav();

  // Keep the active sidebar + nav in sync as routes change.
  window.addEventListener('hashchange', () => { renderSidebar(); syncNav(); });

  // Re-render auth + sidebar whenever store changes (login/logout/native lang).
  store.subscribe(() => {
    renderAuthArea();
    renderSidebar();
    tokenizeChrome();
    updateDueBadge();
    // Refresh the current view so add/edit buttons appear/disappear.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

init();
