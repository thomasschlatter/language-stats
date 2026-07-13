// Tips view: community language-learning advice. Tip bodies are markdown-based
// (the same small markup as articles: # headings, - lists, {{locale|word}}),
// so every word is clickable and any list can be turned into a flashcard deck.
// Authors can edit their own tips.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { renderText, tokenizeTree } from '../render.js';
import { parseArticle } from '../articleMarkup.js';
import { languageTabs } from './tabs.js';
import { signInPrompt } from '../auth.js';
import { attachDeckButtons } from './listToDeck.js';
import { voteButton } from './voteButton.js';
import { navigate } from '../router.js';

export async function renderTips(langCode) {
  const view = clear(document.getElementById('view'));
  const language = store.languages.find((l) => l.code === langCode);
  if (!language) {
    view.append(el('p', { class: 'muted' }, 'Unknown language.'));
    return;
  }

  view.append(languageTabs(langCode, 'tips'));
  view.append(
    el('div', { class: 'section-head' }, [
      el('h1', {}, `${language.name} tips`),
      store.user
        ? el('button', { class: 'btn small', onclick: () => openTipEditor(language, () => renderTips(langCode)) }, '+ Share a tip')
        : signInPrompt('to share tips'),
    ])
  );

  // Compact progress strip above the tips (for signed-in learners).
  if (store.user) {
    const strip = el('a', { class: 'tips-progress', href: `#/lang/${langCode}/progress` },
      el('span', { class: 'muted' }, 'Loading your progress…'));
    view.append(strip);
    api.progress(langCode)
      .then(({ summary }) => {
        clear(strip).append(
          el('span', {}, [el('strong', {}, String(summary.known)), ' words known']),
          summary.hasFrequency
            ? el('span', {}, [el('strong', {}, `${summary.coveragePct || 0}%`), ' of conversation'])
            : el('span', { class: 'muted' }, 'coverage n/a here'),
          el('span', { class: 'tips-progress-link' }, 'Full progress →')
        );
      })
      .catch(() => strip.remove());
  }

  const list = el('div', { class: 'tips-list' });
  view.append(list);
  list.append(el('p', { class: 'muted' }, 'Loading…'));

  const { tips } = await api.tips(langCode);
  clear(list);
  if (!tips.length) {
    list.append(el('p', { class: 'muted' }, 'No tips yet. Be the first to share one!'));
    tokenizeTree(view);
    return;
  }

  const bodies = []; // { bodyEl, name } — deck buttons attached after tokenizing
  for (const t of tips) {
    const bodyLang = t.body_lang || store.nativeLang;
    const canEdit = store.user && store.user.id === t.user_id;
    const bodyEl = el('div', { class: 'tip-body article-body', lang: bodyLang }, parseArticle(t.body, bodyLang));
    bodies.push({ bodyEl, name: t.title });

    list.append(
      el('div', { class: 'card' }, [
        el('div', { class: 'section-head', style: 'align-items:flex-start' }, [
          el('h3', {}, renderText(t.title, bodyLang)),
          el('div', { class: 'row', style: 'gap:0.5rem; align-items:center' }, [
            canEdit
              ? el('button', { class: 'btn small secondary', onclick: () => openTipEditor(language, () => renderTips(langCode), t) }, 'Edit')
              : null,
            voteButton(t, api.voteTip),
          ]),
        ]),
        bodyEl,
        el('div', { class: 'meta', style: 'margin-top:0.5rem' }, `by @${t.author} · written in ${bodyLang} · ${t.created_at}`),
      ])
    );
  }
  tokenizeTree(view);
  // After tokenizing (so buttons aren't tokenized), offer a deck per list.
  for (const { bodyEl, name } of bodies) attachDeckButtons(bodyEl, langCode, name);
}

// Create (tip omitted) or edit (tip given) a tip. Markdown-aware.
function openTipEditor(language, onDone, tip = null) {
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
