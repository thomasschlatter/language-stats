// Word detail view: shows a word, its meaning, and its linked translations as
// clickable chips (each navigates to that word). Signed-in users can add a new
// translation link — creating the target word on the fly if it doesn't exist.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';

export async function renderWordDetail(id) {
  const view = clear(document.getElementById('view'));
  view.append(el('p', { class: 'muted' }, 'Loading…'));

  let data;
  try {
    data = await api.word(id);
  } catch (ex) {
    clear(view).append(el('p', { class: 'error' }, ex.message));
    return;
  }

  const { word, links } = data;
  clear(view);

  const container = el('div', { class: 'word-detail' });
  container.append(
    el('a', { href: `#/lang/${word.language_code}`, class: 'muted' }, `← ${word.language_name}`),
    el('h1', {}, word.text),
    el('div', { class: 'lang-tag' }, word.language_name),
    el('div', { class: 'meaning' }, word.meaning || el('span', { class: 'muted' }, 'No meaning recorded yet.'))
  );

  // Linked translations / related words
  container.append(el('div', { class: 'links-title' }, 'Translations & links'));
  const linkGrid = el('div', { class: 'word-grid' });
  if (!links.length) {
    linkGrid.append(el('span', { class: 'muted' }, 'No links yet.'));
  } else {
    for (const l of links) {
      linkGrid.append(
        el('a', { class: 'word-chip', href: `#/word/${l.id}`, title: l.meaning || '' }, [
          l.text,
          el('span', { class: 'lang' }, l.language_code.toUpperCase()),
        ])
      );
    }
  }
  container.append(linkGrid);

  if (store.user) {
    container.append(
      el('div', { class: 'row', style: 'margin-top:1rem' }, [
        el('button', { class: 'btn small', onclick: () => openLinkModal(word) }, '+ Add translation / link'),
      ])
    );
  } else {
    container.append(el('p', { class: 'muted', style: 'margin-top:1rem' }, 'Sign in to add links.'));
  }

  view.append(container);
}

function openLinkModal(word) {
  const err = el('div', { class: 'error' });

  const langSelect = el('select', {}, store.languages.map((l) =>
    el('option', { value: l.code }, l.name)
  ));
  const text = el('input', { type: 'text', placeholder: 'the translated / related word' });
  const meaning = el('input', { type: 'text', placeholder: 'meaning (optional)' });
  const type = el('select', {}, [
    el('option', { value: 'translation' }, 'Translation'),
    el('option', { value: 'synonym' }, 'Synonym'),
    el('option', { value: 'related' }, 'Related'),
  ]);

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        await api.linkWord(word.id, {
          targetLanguageCode: langSelect.value,
          targetText: text.value,
          targetMeaning: meaning.value || undefined,
          type: type.value,
        });
        close();
        renderWordDetail(word.id); // refresh
      } catch (ex) {
        err.textContent = ex.message;
      }
    },
  }, [
    el('label', {}, 'Language'),
    langSelect,
    el('label', {}, 'Word'),
    text,
    el('label', {}, 'Meaning'),
    meaning,
    el('label', {}, 'Link type'),
    type,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [
      el('button', { class: 'btn', type: 'submit' }, 'Link'),
    ]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, `Link "${word.text}"`), form]));
}
