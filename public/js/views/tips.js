// Tips view: community language-learning advice. Tip bodies are markdown-based
// (the same small markup as articles: # headings, - lists, {{locale|word}}),
// so every word is clickable and any list can be turned into a flashcard deck.
// Authors can edit their own tips.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { renderText, tokenizeTree } from '../render.js';
import { parseArticle } from '../articleMarkup.js';
import { signInPrompt } from '../auth.js';
import { attachDeckButtons } from './listToDeck.js';
import { voteButton } from './voteButton.js';
import { navigate } from '../router.js';

// A tip's own page (a "card" in the unified list links here). Same layout as an
// article: title, vote, author-only edit, markdown body with clickable words and
// list→deck buttons.
export async function renderTip(id) {
  const view = clear(document.getElementById('view'));
  view.append(el('p', { class: 'muted' }, 'Loading…'));

  let tip;
  try {
    tip = (await api.tip(id)).tip;
  } catch (ex) {
    clear(view).append(el('p', { class: 'error' }, ex.message));
    return;
  }

  clear(view);
  const bodyLang = tip.body_lang || store.nativeLang;
  const canEdit = store.user && store.user.id === tip.user_id;
  const language = store.languages.find((l) => l.code === tip.language_code);

  const container = el('article', { class: 'article', lang: bodyLang }, [
    el('a', { href: `#/lang/${encodeURIComponent(tip.language_code)}`, class: 'muted back' }, `← ${tip.language_name}`),
    el('div', { class: 'article-head' }, [
      el('h1', {}, renderText(tip.title, bodyLang)),
      el('div', { class: 'row', style: 'gap:0.5rem; align-items:center' }, [
        canEdit ? el('button', { class: 'btn small secondary', onclick: () => openTipEditor(language, () => renderTip(id), tip) }, 'Edit') : null,
        voteButton(tip, api.voteTip),
      ]),
    ]),
    el('div', { class: 'article-meta' }, `by @${tip.author} · about ${tip.language_name} · written in ${bodyLang}`),
    el('div', { class: 'article-body tip-body', lang: bodyLang }, parseArticle(tip.body, bodyLang)),
  ]);
  view.append(container);

  tokenizeTree(container);
  attachDeckButtons(container, tip.language_code, tip.title);
}

// Create (tip omitted) or edit (tip given) a tip. Markdown-aware.
export function openTipEditor(language, onDone, tip = null) {
  const editing = !!tip;
  const err = el('div', { class: 'error' });
  const title = el('input', { type: 'text', placeholder: 'short title', value: tip?.title || '' });
  const body = el('textarea', {
    rows: '10',
    placeholder: 'Share your trick for learning…\n\nMarkdown: # heading, "- " for bullet lists, blank line = new paragraph.\nTip: any list can be turned into a flashcard deck.',
  });
  body.value = tip?.body || '';
  // "Written for" = the language the tip is ABOUT (defaults to the current
  // page's language). Only offered on create — updating which language a tip
  // belongs to isn't supported.
  const writtenFor = el('select', {},
    store.languages.map((l) =>
      el('option', { value: l.code, selected: l.code === language.code ? '' : null }, l.name))
  );
  // "Written in" = the language the prose is written in (defaults to native).
  const writtenIn = el('select', {},
    store.languages.map((l) => {
      const selected = l.code === (tip?.body_lang || store.nativeLang);
      return el('option', { value: l.code, selected: selected ? '' : null }, l.name);
    })
  );

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        if (editing) {
          await api.updateTip(tip.id, {
            title: title.value,
            body: body.value,
            bodyLanguageCode: writtenIn.value,
          });
          close();
          onDone();
        } else {
          await api.createTip({
            languageCode: writtenFor.value,
            bodyLanguageCode: writtenIn.value,
            title: title.value,
            body: body.value,
          });
          close();
          // If the tip is about another language, jump to that language's tips.
          if (writtenFor.value !== language.code) navigate(`#/lang/${writtenFor.value}/tips`);
          else onDone();
        }
      } catch (ex) {
        err.textContent = ex.message;
      }
    },
  }, [
    el('label', {}, 'Title'),
    title,
    el('label', {}, 'Your tip (markdown)'),
    body,
    el('div', { class: 'muted', style: 'font-size:0.78rem; margin-top:0.3rem' },
      'Use "- " for bullet lists and "# " for headings. Readers can turn any list into a flashcard deck.'),
    ...(editing ? [] : [el('label', {}, 'Written for (the language this tip is about)'), writtenFor]),
    el('label', {}, 'Written in (the language you’re writing in)'),
    writtenIn,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [
      el('button', { class: 'btn', type: 'submit' }, editing ? 'Save changes' : 'Post tip'),
    ]),
  ]);

  const heading = editing ? 'Edit tip' : `Share a ${language.name} tip`;
  const close = openModal(el('div', {}, [el('h2', {}, heading), form]));
}
