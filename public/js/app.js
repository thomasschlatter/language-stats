// App bootstrap: loads languages + current user, renders the sidebar and auth
// area, then starts the router. Re-renders reactive bits when auth changes.

import { api } from './api.js';
import { store } from './store.js';
import { el, clear, openModal } from './dom.js';
import { tokenizeTree } from './render.js';
import { loadCurrentUser, renderAuthArea } from './auth.js';
import { startRouter } from './router.js';

// Make the persistent chrome (sidebar heading, top-bar labels) clickable too.
function tokenizeChrome() {
  tokenizeTree(document.querySelector('.sidebar'));
  tokenizeTree(document.getElementById('auth-area'));
}

function reloadLanguages() {
  return api.languages().then(({ languages }) => store.set({ languages })).catch(() => {});
}

function renderSidebar() {
  const nav = clear(document.getElementById('language-list'));
  const currentCode = decodeURIComponent((window.location.hash.match(/#\/lang\/([^/]+)/) || [])[1] || '');

  for (const lang of store.languages) {
    const row = el('div', { class: 'lang-row' }, [
      el('a', { href: `#/lang/${lang.code}`, class: lang.code === currentCode ? 'active' : '' }, lang.name),
    ]);
    if (lang.code === store.nativeLang) {
      row.append(el('span', { class: 'lang-native-tag', title: 'Your native language' }, 'native'));
    }
    if (store.user) {
      row.append(el('button', {
        class: 'lang-remove', title: `Remove ${lang.name}`,
        onclick: (e) => { e.preventDefault(); confirmRemoveLanguage(lang); },
      }, '×'));
    }
    nav.append(row);
  }
  if (!store.languages.length) nav.append(el('span', { class: 'muted' }, 'No languages yet.'));
  if (store.user) {
    nav.append(el('button', { class: 'lang-add', onclick: openAddLanguage }, '+ Add language'));
  }
}

function confirmRemoveLanguage(lang) {
  const close = openModal(el('div', {}, [
    el('h2', {}, `Remove ${lang.name}?`),
    el('p', { class: 'muted' }, 'This permanently deletes all of its words, cards, tips and messages.'),
    el('div', { class: 'row', style: 'justify-content:flex-end; margin-top:1rem' }, [
      el('button', { class: 'btn small secondary', type: 'button', onclick: () => close() }, 'Cancel'),
      el('button', {
        class: 'btn small danger', type: 'button',
        onclick: async () => {
          try {
            await api.deleteLanguage(lang.code);
            await reloadLanguages();
            renderSidebar();
            if ((window.location.hash || '').startsWith(`#/lang/${lang.code}`)) {
              window.location.hash = store.languages[0] ? `#/lang/${store.languages[0].code}` : '#/';
            }
          } catch { /* ignore */ }
          close();
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
  // Load languages + user in parallel.
  const [langsResult] = await Promise.allSettled([api.languages(), loadCurrentUser()]);
  if (langsResult.status === 'fulfilled') {
    store.set({ languages: langsResult.value.languages });
  }

  renderSidebar();
  renderAuthArea();
  tokenizeChrome();
  startRouter();

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
    // Refresh the current view so add/edit buttons appear/disappear.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

init();
