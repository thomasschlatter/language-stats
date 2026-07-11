// Hash-based router. Keeps the app a static SPA (no server routing needed for
// navigation) while URLs stay shareable, e.g. #/lang/de, #/word/42.

import { store } from './store.js';
import { renderWords } from './views/words.js';
import { renderWordDetail } from './views/wordDetail.js';
import { renderTips } from './views/tips.js';

const routes = [
  { pattern: /^#\/lang\/([^/]+)\/tips$/, handler: (m) => renderTips(m[1]) },
  { pattern: /^#\/lang\/([^/]+)$/, handler: (m) => renderWords(m[1]) },
  { pattern: /^#\/word\/(\d+)$/, handler: (m) => renderWordDetail(Number(m[1])) },
];

export function navigate(hash) {
  window.location.hash = hash;
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

function render() {
  const hash = window.location.hash || '#/';

  // Default route -> first available language's words.
  if (hash === '#/' || hash === '') {
    const first = store.languages[0];
    if (first) return navigate(`#/lang/${first.code}`);
  }

  for (const { pattern, handler } of routes) {
    const m = hash.match(pattern);
    if (m) return handler(m);
  }

  document.getElementById('view').innerHTML =
    '<p class="muted">Nothing here. Pick a language from the left.</p>';
}
