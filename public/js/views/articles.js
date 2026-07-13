// Cards view: the clickable cards shown when you pick a language. Each card is
// an article (official or user-made) and links to its full page. Signed-in
// users can author their own cards using the article markup.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { tokenizeTree } from '../render.js';
import { languageTabs } from './tabs.js';
import { voteButton } from './voteButton.js';
import { signInPrompt } from '../auth.js';
import { navigate } from '../router.js';

export async function renderArticles(langCode) {
  const view = clear(document.getElementById('view'));
  const language = store.languages.find((l) => l.code === langCode);
  if (!language) {
    view.append(el('p', { class: 'muted' }, 'Unknown language.'));
    return;
  }

  view.append(languageTabs(langCode, 'cards'));
  view.append(
    el('div', { class: 'section-head' }, [
      el('h1', {}, `${language.name} cards`),
      store.user
        ? el('button', { class: 'btn small', onclick: () => openNewCard(language) }, '+ New card')
        : signInPrompt('to create cards'),
    ])
  );
  const note = el('p', { class: 'muted', style: 'margin-top:-0.5rem' });
  view.append(note);

  const grid = el('div', { class: 'card-grid' });
  view.append(grid);
  grid.append(el('span', { class: 'muted' }, 'Loading…'));

  // Cards are filtered to the learner's native language. If there are none,
  // fall back to English (the common lingua franca) rather than every language —
  // a German speaker shouldn't be shown the Spanish version of a card. Only if
  // there's no English card either do we show all, as a last resort.
  let { articles } = await api.articles(langCode, store.nativeLang);
  let mode = 'native';
  if (!articles.length && store.nativeLang.split('-')[0] !== 'en') {
    ({ articles } = await api.articles(langCode, 'en'));
    if (articles.length) mode = 'english';
  }
  if (!articles.length) {
    ({ articles } = await api.articles(langCode));
    if (articles.length) mode = 'all';
  }

  clear(grid);
  note.textContent = {
    native: `Showing cards written in your native language (${store.nativeLang}). Change it top-right.`,
    english: `No cards in your native language (${store.nativeLang}) yet — showing English cards. Change your native language top-right.`,
    all: `No cards in your native language (${store.nativeLang}) or English yet — showing all cards. Change your native language top-right.`,
  }[mode];

  if (!articles.length) {
    grid.append(el('p', { class: 'muted' }, 'No cards yet. Create the first one!'));
  }
  for (const a of articles) {
    // The whole card is one link to the article; the vote button inside stops
    // propagation so it doesn't navigate.
    grid.append(
      el('a', { class: 'card article-card', href: `#/article/${a.id}` }, [
        el('div', { class: 'card-top' }, [
          el('div', { class: 'card-badges' }, [
            a.is_official
              ? el('span', { class: 'badge official' }, 'Official')
              : el('span', { class: 'badge user' }, `@${a.author || 'user'}`),
            a.body_lang ? el('span', { class: 'badge lang' }, a.body_lang) : null,
          ]),
          voteButton(a),
        ]),
        el('h3', {}, a.title),
        a.summary ? el('p', { class: 'muted card-summary' }, a.summary) : null,
      ])
    );
  }

  // Tokenize the surrounding chrome (heading, hints). Cards are <a> links, so
  // their inner text is left intact as a single click target.
  tokenizeTree(view);
}

const MARKUP_HELP =
  'Markup:  "# Heading"  ·  "- bullet"  ·  blank line = new paragraph  ·  ' +
  '"[coverage]" inserts the % of conversation buttons  ·  "{{de-DE|der Tisch}}" tags text as a locale.';

function openNewCard(language) {
  const err = el('div', { class: 'error' });
  const title = el('input', { type: 'text', placeholder: 'card title' });
  const summary = el('input', { type: 'text', placeholder: 'one-line summary (optional)' });
  const body = el('textarea', {
    placeholder: '# My heading\n\nSome text about {{de-DE|die Sprache}}.\n\n[coverage]',
    style: 'min-height:180px; font-family:ui-monospace, monospace;',
  });
  const writtenIn = el('select', {},
    store.languages.map((l) =>
      el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.name)
    )
  );

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        const { article } = await api.createArticle({
          languageCode: language.code,
          bodyLanguageCode: writtenIn.value,
          title: title.value,
          summary: summary.value || undefined,
          body: body.value,
        });
        close();
        navigate(`#/article/${article.id}`);
      } catch (ex) {
        err.textContent = ex.message;
      }
    },
  }, [
    el('label', {}, 'Title'), title,
    el('label', {}, 'Summary'), summary,
    el('label', {}, 'Body'), body,
    el('div', { class: 'muted', style: 'font-size:0.78rem; margin-top:0.35rem' }, MARKUP_HELP),
    el('label', {}, 'Written in'), writtenIn,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Create card')]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, `New ${language.name} card`), form]));
}
