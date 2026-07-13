// Hash-based router. URLs stay shareable:
//   #/lang/de-DE            -> reader for a locale
//   #/lang/de-DE/tips       -> tips for a locale
//   #/w/de-DE/ich           -> a word element's page
//
// A word URL carries the locale AND the text, matching the "each word is a
// language-tagged element" model.

import { store } from './store.js';
import { el, clear } from './dom.js';
import { byImportance } from './langOrder.js';
import { signInPrompt } from './auth.js';
import { renderArticles } from './views/articles.js';
import { renderArticle } from './views/article.js';
import { renderWordPage } from './views/wordPage.js';
import { renderChat } from './views/chat.js';
import { renderProgress } from './views/progress.js';
import { renderUserProfile } from './views/userProfile.js';
import { renderCommunity } from './views/community.js';
import { renderMessages } from './views/messages.js';
import { renderDmThread } from './views/dmThread.js';
import { renderSettings } from './views/settings.js';
import { renderSearch } from './views/search.js';
import { renderWorld } from './views/world.js';
import { renderDecks } from './views/decks.js';
import { renderStudy } from './views/study.js';

const routes = [
  { pattern: /^#\/community$/, handler: () => renderCommunity() },
  { pattern: /^#\/world$/, handler: () => renderWorld(), auth: true },
  { pattern: /^#\/search\/(.+)$/, handler: (m) => renderSearch(dec(m[1])) },
  { pattern: /^#\/settings$/, handler: () => renderSettings(), auth: true },
  { pattern: /^#\/decks$/, handler: () => renderDecks(), auth: true },
  { pattern: /^#\/study\/(\d+)$/, handler: (m) => renderStudy(Number(m[1])), auth: true },
  { pattern: /^#\/messages$/, handler: () => renderMessages(), auth: true },
  { pattern: /^#\/dm\/([^/]+)$/, handler: (m) => renderDmThread(dec(m[1])), auth: true },
  { pattern: /^#\/u\/([^/]+)$/, handler: (m) => renderUserProfile(dec(m[1])) },
  { pattern: /^#\/chat$/, handler: () => renderChat(), auth: true },
  { pattern: /^#\/chat\/([^/]+)$/, handler: (m) => renderChat(dec(m[1])), auth: true },
  // Tips + cards are one unified page now; old /tips links still resolve there.
  { pattern: /^#\/lang\/([^/]+)\/tips$/, handler: (m) => renderArticles(dec(m[1])) },
  { pattern: /^#\/lang\/([^/]+)\/progress$/, handler: (m) => renderProgress(dec(m[1])), auth: true },
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

  // Default route -> a language you're learning (never your native language),
  // preferred over the alphabetically-first catalogue entry.
  if (hash === '#/' || hash === '') {
    const learning = store.languages
      .filter((l) => store.isLearning(l.code) && l.code !== store.nativeLang)
      .sort(byImportance);
    const target = learning[0]
      || store.languages.find((l) => l.code !== store.nativeLang)
      || store.languages[0];
    if (target) return navigate(`#/lang/${encodeURIComponent(target.code)}`);
  }

  for (const { pattern, handler, auth } of routes) {
    const m = hash.match(pattern);
    if (!m) continue;
    if (auth && !store.user) return renderAuthRequired();
    return handler(m);
  }

  document.getElementById('view').innerHTML =
    '<p class="muted">Nothing here. Pick a language from the left.</p>';
}

// Shown instead of a private page when signed out.
function renderAuthRequired() {
  const view = clear(document.getElementById('view'));
  view.append(
    el('h1', {}, 'Sign in required'),
    el('p', {}, signInPrompt('to view this page.'))
  );
}
