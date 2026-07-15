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
import { syncBodyClasses } from './bodyClasses.js';
import { signInPrompt } from './auth.js';
import { renderArticles } from './views/articles.js';
import { renderArticle } from './views/article.js';
import { renderWordPage } from './views/wordPage.js';
import { renderTip } from './views/tips.js';
import { renderChat } from './views/chat.js';
import { renderProgress } from './views/progress.js';
import { renderUserProfile } from './views/userProfile.js';
import { renderCommunity } from './views/community.js';
import { renderMessages } from './views/messages.js';
import { renderDmThread } from './views/dmThread.js';
import { renderSettings } from './views/settings.js';
import { renderSearch } from './views/search.js';
import { renderWorld } from './views/world.js';
import { renderGames } from './views/games.js';
import { renderDecks } from './views/decks.js';
import { renderBrowseDecks } from './views/browseDecks.js';
import { renderPublicDeck } from './views/publicDeck.js';
import { renderStudy } from './views/study.js';
import { renderGroups, renderGroup, renderGroupInvite } from './views/groups.js';
import { renderFoxyHelp } from './views/foxyHelp.js';

const routes = [
  { pattern: /^#\/community$/, handler: () => renderCommunity() },
  // "Tips" nav item -> cards & tips for every language you're learning (one
  // carousel row per language). A general, language-agnostic entry point.
  { pattern: /^#\/tips$/, handler: () => renderArticles() },
  { pattern: /^#\/lang\/tips$/, handler: () => renderArticles() },
  { pattern: /^#\/world$/, handler: () => renderWorld(), auth: true },
  { pattern: /^#\/games$/, handler: () => renderGames(), auth: true },
  { pattern: /^#\/search\/(.+)$/, handler: (m) => renderSearch(dec(m[1])) },
  // Settings now live on your profile (/me). Send the Settings link there.
  { pattern: /^#\/settings$/, handler: () => {
    if (store.user) navigate(`#/u/${encodeURIComponent(store.user.username)}`);
    else navigate('#/');
  } },
  { pattern: /^#\/decks$/, handler: () => renderDecks(), auth: true },
  { pattern: /^#\/decks\/browse$/, handler: () => renderBrowseDecks() },
  { pattern: /^#\/decks\/public\/(\d+)$/, handler: (m) => renderPublicDeck(Number(m[1])) },
  { pattern: /^#\/study$/, handler: () => renderStudy(), auth: true }, // all decks
  { pattern: /^#\/study\/(\d+)$/, handler: (m) => renderStudy(Number(m[1])), auth: true },
  { pattern: /^#\/groups$/, handler: () => renderGroups(), auth: true },
  { pattern: /^#\/groups\/(\d+)$/, handler: (m) => renderGroup(Number(m[1])), auth: true },
  { pattern: /^#\/g\/([^/]+)$/, handler: (m) => renderGroupInvite(dec(m[1])), auth: true },
  { pattern: /^#\/foxy$/, handler: () => renderFoxyHelp() },
  { pattern: /^#\/messages$/, handler: () => renderMessages(), auth: true },
  // DMing the bot (Foxy / legacy Groupifier) opens the Ask Foxy assistant.
  { pattern: /^#\/dm\/([^/]+)$/, handler: (m) => { const u = dec(m[1]); return /^(foxy|groupifier)$/i.test(u) ? renderFoxyHelp() : renderDmThread(u); }, auth: true },
  { pattern: /^#\/u\/([^/]+)$/, handler: (m) => renderUserProfile(dec(m[1])) },
  { pattern: /^#\/chat$/, handler: () => renderChat(), auth: true },
  { pattern: /^#\/chat\/([^/]+)$/, handler: (m) => renderChat(dec(m[1])), auth: true },
  // Tips + cards are one unified page now; old /tips links still resolve there.
  { pattern: /^#\/lang\/([^/]+)\/tips$/, handler: (m) => renderArticles(dec(m[1])) },
  { pattern: /^#\/lang\/([^/]+)\/progress$/, handler: (m) => renderProgress(dec(m[1])), auth: true },
  { pattern: /^#\/lang\/([^/]+)$/, handler: (m) => renderArticles(dec(m[1])) },
  { pattern: /^#\/article\/(\d+)$/, handler: (m) => renderArticle(Number(m[1])) },
  { pattern: /^#\/tip\/(\d+)$/, handler: (m) => renderTip(Number(m[1])) },
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
  syncBodyClasses(hash); // reconcile fixed-layout classes on every render

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
