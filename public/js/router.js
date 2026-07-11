// Hash-based router. URLs stay shareable:
//   #/lang/de-DE            -> reader for a locale
//   #/lang/de-DE/tips       -> tips for a locale
//   #/w/de-DE/ich           -> a word element's page
//
// A word URL carries the locale AND the text, matching the "each word is a
// language-tagged element" model.

import { store } from './store.js';
import { renderArticles } from './views/articles.js';
import { renderArticle } from './views/article.js';
import { renderWordPage } from './views/wordPage.js';
import { renderTips } from './views/tips.js';
import { renderChat } from './views/chat.js';

const routes = [
  { pattern: /^#\/lang\/([^/]+)\/tips$/, handler: (m) => renderTips(dec(m[1])) },
  { pattern: /^#\/lang\/([^/]+)\/chat$/, handler: (m) => renderChat(dec(m[1])) },
  { pattern: /^#\/lang\/([^/]+)$/, handler: (m) => renderArticles(dec(m[1])) },
  { pattern: /^#\/article\/(\d+)$/, handler: (m) => renderArticle(Number(m[1])) },
  { pattern: /^#\/w\/([^/]+)\/(.+)$/, handler: (m) => renderWordPage(dec(m[1]), dec(m[2])) },
];

const dec = (s) => decodeURIComponent(s);

export function navigate(hash) {
  window.location.hash = hash;
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

function render() {
  const hash = window.location.hash || '#/';

  // Default route -> first available language's reader.
  if (hash === '#/' || hash === '') {
    const first = store.languages[0];
    if (first) return navigate(`#/lang/${encodeURIComponent(first.code)}`);
  }

  for (const { pattern, handler } of routes) {
    const m = hash.match(pattern);
    if (m) return handler(m);
  }

  document.getElementById('view').innerHTML =
    '<p class="muted">Nothing here. Pick a language from the left.</p>';
}
