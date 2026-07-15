// The language page: instead of picking one language, every language you're
// learning gets its own row — a horizontal carousel of that language's cards &
// tips, best (official → most-upvoted → newest) on the left. The language in the
// URL (#/lang/de-DE) is just ordered first.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { tokenizeTree } from '../render.js';
import { voteButton } from './voteButton.js';
import { signInPrompt } from '../auth.js';
import { openTipEditor } from './tips.js';

export async function renderArticles(langCode) {
  const view = clear(document.getElementById('view'));

  // Which languages to show: everything you're learning, with the URL's language
  // first. Fall back to just the requested language if you're not learning any.
  const learning = store.languages
    .filter((l) => store.isLearning(l.code) && l.code !== store.nativeLang);
  let langs = learning.slice().sort((a, b) => {
    if (a.code === langCode) return -1;
    if (b.code === langCode) return 1;
    return a.name.localeCompare(b.name);
  });
  if (!langs.length) {
    const one = langCode && store.languages.find((l) => l.code === langCode);
    langs = one ? [one] : [];
  }
  if (!langs.length) {
    view.append(el('h1', {}, 'Cards & tips'));
    view.append(el('p', { class: 'muted' }, 'Add a language you’re learning to see its cards and tips here.'));
    return;
  }

  view.append(
    el('div', { class: 'section-head' }, [
      el('h1', { style: 'margin:0' }, 'Cards & tips'),
      store.user ? null : signInPrompt('to add cards & tips'),
    ])
  );

  // Render a row per language. Build them all, then fill each as its data loads.
  for (const language of langs) {
    const carousel = el('div', { class: 'lang-carousel' }, el('span', { class: 'muted' }, 'Loading…'));
    view.append(
      el('section', { class: 'lang-section' }, [
        el('div', { class: 'lang-section-head' }, [
          el('a', { class: 'lang-section-title', href: `#/lang/${encodeURIComponent(language.code)}/tips` }, language.name),
        ]),
        carousel,
      ])
    );
    fillCarousel(carousel, language); // fire-and-forget so rows load in parallel

  }
}

async function fillCarousel(carousel, language) {
  const langCode = language.code;
  let articles = [];
  try {
    ({ articles } = await api.articles(langCode, store.nativeLang));
    if (!articles.length && store.nativeLang.split('-')[0] !== 'en') {
      ({ articles } = await api.articles(langCode, 'en'));
    }
    if (!articles.length) ({ articles } = await api.articles(langCode));
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
  // Best on the left: curated (official) first, then most-upvoted, then newest.
  entries.sort((a, b) => (b.is_official - a.is_official) || (b.votes - a.votes) || (b.id - a.id));

  clear(carousel);
  for (const e of entries) {
    carousel.append(
      el('a', { class: 'card article-card carousel-card', href: e.href }, [
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
  // The "add" tile trails the row so the best tip stays leftmost.
  if (store.user) {
    carousel.append(
      el('button', { class: 'card add-card carousel-card', onclick: () => openTipEditor(language, () => renderArticles(langCode)) }, [
        el('span', { class: 'add-card-plus' }, '+'),
        el('span', {}, 'Add a card or tip'),
      ])
    );
  } else if (!entries.length) {
    carousel.append(el('p', { class: 'muted' }, 'Nothing here yet.'));
  }
  tokenizeTree(carousel);
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
