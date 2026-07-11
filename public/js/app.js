// App bootstrap: loads languages + current user, renders the sidebar and auth
// area, then starts the router. Re-renders reactive bits when auth changes.

import { api } from './api.js';
import { store } from './store.js';
import { el, clear } from './dom.js';
import { tokenizeTree } from './render.js';
import { loadCurrentUser, renderAuthArea } from './auth.js';
import { startRouter } from './router.js';

// Make the persistent chrome (sidebar heading, top-bar labels) clickable too.
function tokenizeChrome() {
  tokenizeTree(document.querySelector('.sidebar'));
  tokenizeTree(document.getElementById('auth-area'));
}

function renderSidebar() {
  const nav = clear(document.getElementById('language-list'));
  if (!store.languages.length) {
    nav.append(el('span', { class: 'muted' }, 'No languages yet.'));
    return;
  }
  const currentCode = (window.location.hash.match(/#\/lang\/([^/]+)/) || [])[1];
  for (const lang of store.languages) {
    nav.append(
      el('a', {
        href: `#/lang/${lang.code}`,
        class: lang.code === currentCode ? 'active' : '',
      }, lang.name)
    );
  }
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

  // Keep the active sidebar item in sync as routes change.
  window.addEventListener('hashchange', renderSidebar);

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
