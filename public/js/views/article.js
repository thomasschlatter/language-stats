// Article page: renders a card's markup body, makes every word clickable, and
// mounts any interactive [coverage] widgets.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { navigate } from '../router.js';
import { tokenizeTree } from '../render.js';
import { parseArticle } from '../articleMarkup.js';
import { coverageWidget } from './coverageWidget.js';
import { genderStatsWidget } from './genderStatsWidget.js';
import { genderNounsWidget } from './genderNounsWidget.js';
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
      el('div', { class: 'row', style: 'gap:0.5rem; align-items:center' }, [
        store.user ? el('button', { class: 'btn small secondary', onclick: () => openTranslate(article) }, '🌐 Translate') : null,
        voteButton(article),
      ]),
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
  for (const mount of container.querySelectorAll('.gender-nouns-mount')) {
    mount.append(genderNounsWidget(article.language_code));
  }

  // Let the reader turn any list in the article into a flashcard deck.
  attachDeckButtons(container, article.language_code, article.title);
}

// Translate this card into another language with the on-device AI model, saving
// the result as a new card.
function openTranslate(article) {
  const err = el('div', { class: 'error' });
  const status = el('div', { class: 'muted', style: 'font-size:0.82rem' });
  const srcBase = (article.body_lang || 'en').split('-')[0];
  const sel = el('select', {},
    store.languages
      .filter((l) => l.lang !== srcBase)
      .map((l) => el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.name))
  );
  const submit = el('button', { class: 'btn', type: 'submit' }, 'Translate & save');
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      submit.disabled = true;
      status.textContent = 'Translating on-device… the first use of a language pair downloads the model (~1 min), then it is quick.';
      try {
        const { article: created } = await api.translateArticle(article.id, { targetLanguageCode: sel.value });
        close();
        navigate(`#/article/${created.id}`);
      } catch (ex) {
        err.textContent = ex.message;
        submit.disabled = false;
        status.textContent = '';
      }
    },
  }, [
    el('label', {}, 'Translate into'),
    sel,
    el('div', { class: 'muted', style: 'font-size:0.78rem; margin-top:0.3rem' },
      'Runs a local AI model — no data leaves the server. Keeps {{…}} examples and widgets; translates the prose and saves it as a new card.'),
    err,
    status,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [submit]),
  ]);
  const close = openModal(el('div', {}, [el('h2', {}, `Translate “${article.title}”`), form]));
}
