// App bootstrap: loads languages + current user, renders the sidebar and auth
// area, then starts the router. Re-renders reactive bits when auth changes.

import { api } from './api.js';
import { store } from './store.js';
import { el, clear, openModal } from './dom.js';
import { tokenizeTree } from './render.js';
import { loadCurrentUser, renderAuthArea, openLanguageSetup } from './auth.js';
import { startRouter } from './router.js';
import { byImportance } from './langOrder.js';
import { guardSingleInstance } from './singleInstance.js';
import { initChatDrawer } from './chatDrawer.js';
import { syncBodyClasses } from './bodyClasses.js';

// Make the persistent chrome (language bar, top-bar labels) clickable too.
function tokenizeChrome() {
  const lv = document.querySelector('.lang-viewport');
  if (lv) tokenizeTree(lv);
  const auth = document.getElementById('auth-area');
  if (auth) tokenizeTree(auth);
}

function reloadLanguages() {
  return api.languages().then(({ languages }) => store.set({ languages })).catch(() => {});
}

// Persist the learning set to the server (logged-in users) so the carousel
// stays in sync across devices, not just in localStorage.
function persistLearning() {
  if (!store.user) return;
  api.updateProfile({ learning: [...store.learning].filter((c) => c !== store.nativeLang) }).catch(() => {});
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

// Show a badge with unread DM count on the Messages nav item.
async function updateDmBadge() {
  const link = document.querySelector('.topnav a[href="#/messages"]');
  if (!link) return;
  const clearBadges = () => link.querySelectorAll('.due-badge').forEach((b) => b.remove());
  if (!store.user) { clearBadges(); return; }
  try {
    const { count } = await api.dmUnread();
    clearBadges();
    if (count > 0) link.append(el('span', { class: 'due-badge' }, String(count)));
  } catch { /* ignore */ }
}
window.addEventListener('ls:dm-changed', updateDmBadge);

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

// Country flag emoji from a locale code's region (e.g. 'de-DE' -> 🇩🇪).
function flagEmoji(code) {
  const cc = (String(code).split('-')[1] || '').toUpperCase();
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return '';
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

function renderSidebar() {
  const listEl = document.getElementById('language-list');
  if (!listEl) return; // the languages bar was removed
  const nav = clear(listEl);
  const currentCode = decodeURIComponent((window.location.hash.match(/#\/lang\/([^/]+)/) || [])[1] || '');

  // The carousel shows only the languages you're LEARNING (never your native
  // language — you don't learn that). The rest live behind "+ Add languages".
  const learning = store.languages
    .filter((l) => store.isLearning(l.code) && l.code !== store.nativeLang)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const lang of learning) {
    // No inline remove here — manage your languages in Settings.
    const flag = flagEmoji(lang.code);
    nav.append(el('div', { class: 'lang-row' }, [
      el('a', { href: `#/lang/${lang.code}`, class: lang.code === currentCode ? 'active' : '' },
        flag ? `${flag} ${lang.name}` : lang.name),
    ]));
  }
  if (!learning.length) {
    nav.append(el('span', { class: 'muted', style: 'font-size:0.85rem' }, 'Add languages in Settings →'));
  }
  // Adding languages now lives in Settings, so no "+ Add languages" button here.
  refreshLangArrows();
}

// Modal to browse the catalogue and add languages to learn. Excludes your
// native language and anything you're already learning; sorted by importance.
function openLanguagePicker() {
  const listWrap = el('div', { class: 'lang-picker-list' });
  const renderList = () => {
    clear(listWrap);
    const available = store.languages
      .filter((l) => !store.isLearning(l.code) && l.code !== store.nativeLang)
      .sort(byImportance);
    if (!available.length) {
      listWrap.append(el('p', { class: 'muted' }, 'You’re already learning every language in the catalogue!'));
      return;
    }
    for (const lang of available) {
      listWrap.append(el('button', {
        class: 'lang-picker-item', type: 'button',
        onclick: () => { store.addLearning(lang.code); persistLearning(); renderList(); },
      }, [
        el('span', {}, lang.name),
        el('span', { class: 'muted', style: 'font-size:0.72rem' }, '+ add'),
      ]));
    }
  };
  renderList();

  const close = openModal(el('div', { class: 'lang-picker' }, [
    el('h2', {}, 'Add languages to learn'),
    el('p', { class: 'muted', style: 'font-size:0.82rem' }, 'Click a language to add it to your carousel. Ordered by number of speakers.'),
    listWrap,
    store.user
      ? el('button', { class: 'lang-picker-custom', type: 'button', onclick: () => { close(); openAddLanguage(); } }, "+ Can't find it? Add a custom language")
      : null,
    el('div', { class: 'row', style: 'justify-content:flex-end; margin-top:1rem' }, [
      el('button', { class: 'btn small', type: 'button', onclick: () => close() }, 'Done'),
    ]),
  ]));
}

// (The old global "delete language" flow was removed: the carousel × now only
// un-learns a language client-side, so a user's words/decks/progress for it are
// never deleted — re-adding the language brings all their progress back.)

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
  initChatDrawer();
  updateDueBadge();
  updateDmBadge();
  setInterval(updateDmBadge, 60000); // poll for incoming DMs

  // First-run language setup for brand-new accounts (e.g. after LINE signup,
  // which redirects here with ?welcome=1).
  if (store.user && new URLSearchParams(window.location.search).get('welcome') === '1') {
    const url = window.location.pathname + window.location.hash;
    window.history.replaceState(null, '', url); // drop the ?welcome param
    openLanguageSetup();
  }

  // Highlight the active top-nav item, and hide the language carousel inside the
  // immersive World (clicking a language there would yank you out of the world).
  const syncNav = () => {
    const h = window.location.hash || '';
    document.querySelectorAll('.topnav a').forEach((a) => {
      const target = a.getAttribute('href');
      a.classList.toggle('active', h === target || (target !== '#/' && h.startsWith(target)));
    });
    // Fixed, non-page-scrolling layouts (content scrolls internally) — reconciled
    // centrally so a stale overflow:hidden class can't get stuck.
    syncBodyClasses(h);
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
    updateDmBadge();
    // Refresh the current view so add/edit buttons appear/disappear.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

init();
