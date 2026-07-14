// Cards view: the clickable cards shown when you pick a language. Each card is
// an article (official or user-made) and links to its full page. Signed-in
// users can author their own cards using the article markup.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { tokenizeTree } from '../render.js';
import { voteButton } from './voteButton.js';
import { signInPrompt } from '../auth.js';
import { openTipEditor } from './tips.js';
import { navigate } from '../router.js';

// The unified language page: cards and tips are the same kind of thing — one
// combined, upvote-ranked list of entries. Each links to its own page (an
// article page or a tip page). Progress lives on your profile now.
export async function renderArticles(langCode) {
  const view = clear(document.getElementById('view'));
  const language = store.languages.find((l) => l.code === langCode);
  if (!language) {
    view.append(el('p', { class: 'muted' }, 'Unknown language.'));
    return;
  }

  // A compact language switcher (replaces the old languages bar). Shows a
  // dropdown of the languages you're learning, or just the name if there's one.
  const learning = store.languages
    .filter((l) => store.isLearning(l.code) && l.code !== store.nativeLang)
    .sort((a, b) => a.name.localeCompare(b.name));
  const langControl = learning.length > 1
    ? el('select', { class: 'lang-switch', onchange: (e) => navigate(`#/lang/${encodeURIComponent(e.target.value)}`) },
        learning.map((l) => el('option', { value: l.code, selected: l.code === langCode ? '' : null }, l.name)))
    : el('h1', { style: 'margin:0' }, language.name);
  view.append(
    el('div', { class: 'section-head' }, [
      langControl,
      store.user
        ? el('button', { class: 'btn small', onclick: () => openTipEditor(language, () => renderArticles(langCode)) }, '+ Add')
        : signInPrompt('to add cards & tips'),
    ])
  );
  const note = el('p', { class: 'muted', style: 'margin-top:-0.5rem' });
  view.append(note);

  const grid = el('div', { class: 'card-grid' });
  view.append(grid);
  grid.append(el('span', { class: 'muted' }, 'Loading…'));

  // Cards are filtered to the native language (falling back native → English →
  // all so a German speaker isn't shown the Spanish version of a card).
  let articles = [];
  let mode = 'native';
  try {
    ({ articles } = await api.articles(langCode, store.nativeLang));
    if (!articles.length && store.nativeLang.split('-')[0] !== 'en') {
      ({ articles } = await api.articles(langCode, 'en'));
      if (articles.length) mode = 'english';
    }
    if (!articles.length) {
      ({ articles } = await api.articles(langCode));
      if (articles.length) mode = 'all';
    }
  } catch { /* ignore */ }

  let tips = [];
  try { ({ tips } = await api.tips(langCode)); } catch { /* ignore */ }

  const entries = [
    ...articles.map((a) => ({
      id: a.id, title: a.title, summary: a.summary, author: a.author,
      is_official: a.is_official, votes: a.votes || 0, voted: a.voted,
      body_lang: a.body_lang, href: `#/article/${a.id}`, voteFn: api.voteArticle,
    })),
    ...tips.map((t) => ({
      id: t.id, title: t.title, summary: snippet(t.body), author: t.author,
      is_official: 0, votes: t.votes || 0, voted: t.voted,
      body_lang: t.body_lang, href: `#/tip/${t.id}`, voteFn: api.voteTip,
    })),
  ];
  // Curated (official) first, then most-upvoted, then newest.
  entries.sort((a, b) => (b.is_official - a.is_official) || (b.votes - a.votes) || (b.id - a.id));

  clear(grid);
  note.textContent = mode === 'english'
    ? `No cards in your native language (${store.nativeLang}) yet — showing English. Change it on your profile.`
    : mode === 'all'
      ? `No cards in your native language or English yet — showing all.`
      : '';
  if (!entries.length) {
    grid.append(el('p', { class: 'muted' }, 'Nothing here yet. Add the first card or tip!'));
  }
  for (const e of entries) {
    grid.append(
      el('a', { class: 'card article-card', href: e.href }, [
        el('div', { class: 'card-top' }, [
          el('div', { class: 'card-badges' }, [
            e.is_official
              ? el('span', { class: 'badge official' }, 'Official')
              : el('span', { class: 'badge user' }, `@${e.author || 'user'}`),
            e.body_lang ? el('span', { class: 'badge lang' }, e.body_lang) : null,
          ]),
          voteButton(e, e.voteFn),
        ]),
        el('h3', {}, e.title),
        e.summary ? el('p', { class: 'muted card-summary' }, e.summary) : null,
      ])
    );
  }
  tokenizeTree(view);
}

// A plain-text preview of a markdown body (strips markers + {{loc|text}} tokens).
function snippet(body) {
  return String(body)
    .replace(/\{\{[^|}]*\|([^}]*)\}\}/g, '$1')
    .replace(/^[#>\-*\s]+/gm, '')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}
