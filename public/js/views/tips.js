// Tips view: community language-learning advice. Tip bodies are prose, so —
// like everything else on the site — every word is clickable and rendered in
// the locale the tip was written in.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { renderText, tokenizeTree } from '../render.js';
import { languageTabs } from './tabs.js';

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
        ? el('button', { class: 'btn small', onclick: () => openAddTip(language, () => renderTips(langCode)) }, '+ Share a tip')
        : el('span', { class: 'muted' }, 'Sign in to share tips'),
    ])
  );

  const list = el('div', {});
  view.append(list);
  list.append(el('p', { class: 'muted' }, 'Loading…'));

  const { tips } = await api.tips(langCode);
  clear(list);
  if (!tips.length) {
    list.append(el('p', { class: 'muted' }, 'No tips yet. Be the first to share one!'));
    tokenizeTree(view);
    return;
  }
  for (const t of tips) {
    const bodyLang = t.body_lang || store.nativeLang;
    list.append(
      el('div', { class: 'card' }, [
        el('h3', {}, renderText(t.title, bodyLang)),
        el('div', { class: 'tip-body', lang: bodyLang }, renderText(t.body, bodyLang)),
        el('div', { class: 'meta', style: 'margin-top:0.5rem' }, `by @${t.author} · written in ${bodyLang} · ${t.created_at}`),
      ])
    );
  }
  tokenizeTree(view);
}

function openAddTip(language, onDone) {
  const err = el('div', { class: 'error' });
  const title = el('input', { type: 'text', placeholder: 'short title' });
  const body = el('textarea', { placeholder: 'Share your trick for learning…' });
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
        await api.createTip({
          languageCode: language.code,
          bodyLanguageCode: writtenIn.value,
          title: title.value,
          body: body.value,
        });
        close();
        onDone();
      } catch (ex) {
        err.textContent = ex.message;
      }
    },
  }, [
    el('label', {}, 'Title'),
    title,
    el('label', {}, 'Your tip'),
    body,
    el('label', {}, 'Written in'),
    writtenIn,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [
      el('button', { class: 'btn', type: 'submit' }, 'Post tip'),
    ]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, `Share a ${language.name} tip`), form]));
}
