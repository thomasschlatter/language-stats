// Article page: renders a card's markup body, makes every word clickable, and
// mounts any interactive [coverage] widgets.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { tokenizeTree } from '../render.js';
import { parseArticle } from '../articleMarkup.js';
import { coverageWidget } from './coverageWidget.js';
import { genderStatsWidget } from './genderStatsWidget.js';
import { voteButton } from './voteButton.js';
import { attachDeckButtons } from './listToDeck.js';

export async function renderArticle(id) {
  const view = clear(document.getElementById('view'));
  view.append(el('p', { class: 'muted' }, 'Loading…'));

  let article;
  try {
    article = (await api.article(id)).article;
  } catch (ex) {
    clear(view).append(el('p', { class: 'error' }, ex.message));
    return;
  }

  clear(view);
  const bodyLang = article.body_lang || store.nativeLang;
  const author = article.is_official ? 'Official' : `@${article.author || 'user'}`;

  const container = el('article', { class: 'article', lang: bodyLang }, [
    el('a', { href: `#/lang/${encodeURIComponent(article.language_code)}`, class: 'muted back' }, `← ${article.language_name} cards`),
    el('div', { class: 'article-head' }, [
      el('h1', {}, article.title),
      voteButton(article),
    ]),
    el('div', { class: 'article-meta' }, `${author} · about ${article.language_name} · written in ${bodyLang}`),
    el('div', { class: 'article-body' }, parseArticle(article.body, bodyLang)),
  ]);
  view.append(container);

  // 1) Make all prose clickable. 2) Then mount widgets (about-language = the
  // language the card teaches). Widgets are added AFTER tokenizing so their
  // controls stay intact.
  tokenizeTree(container);
  for (const mount of container.querySelectorAll('.coverage-mount')) {
    mount.append(coverageWidget(article.language_code));
  }
  for (const mount of container.querySelectorAll('.gender-mount')) {
    mount.append(genderStatsWidget(article.language_code));
  }

  // Let the reader turn any list in the article into a flashcard deck.
  attachDeckButtons(container, article.language_code, article.title);
}
