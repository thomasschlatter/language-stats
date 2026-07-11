// Words view: lists all words for a language as clickable chips, with search
// and (for signed-in users) an "Add word" action.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { navigate } from '../router.js';
import { languageTabs } from './tabs.js';

export async function renderWords(langCode) {
  const view = clear(document.getElementById('view'));
  const language = store.languages.find((l) => l.code === langCode);
  if (!language) {
    view.append(el('p', { class: 'muted' }, 'Unknown language.'));
    return;
  }

  view.append(languageTabs(langCode, 'words'));

  const head = el('div', { class: 'section-head' }, [
    el('h1', {}, language.name),
    store.user
      ? el('button', { class: 'btn small', onclick: () => openAddWord(language) }, '+ Add word')
      : el('span', { class: 'muted' }, 'Sign in to add words'),
  ]);
  view.append(head);

  const search = el('input', {
    type: 'search',
    placeholder: `Search ${language.name} words…`,
    style: 'max-width:320px; margin-bottom:1rem;',
  });
  view.append(search);

  const grid = el('div', { class: 'word-grid' });
  view.append(grid);

  async function load(q) {
    clear(grid).append(el('span', { class: 'muted' }, 'Loading…'));
    const { words } = await api.words(langCode, q);
    clear(grid);
    if (!words.length) {
      grid.append(el('span', { class: 'muted' }, 'No words yet.'));
      return;
    }
    for (const w of words) {
      grid.append(
        el('a', { class: 'word-chip', href: `#/word/${w.id}`, title: w.meaning || '' }, w.text)
      );
    }
  }

  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => load(search.value.trim()), 200);
  });

  load('');
}

function openAddWord(language) {
  const err = el('div', { class: 'error' });
  const text = el('input', { type: 'text', placeholder: 'the word' });
  const meaning = el('input', { type: 'text', placeholder: 'meaning (optional)' });

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        const { word } = await api.createWord({
          languageCode: language.code,
          text: text.value,
          meaning: meaning.value || undefined,
        });
        close();
        navigate(`#/word/${word.id}`);
      } catch (ex) {
        err.textContent = ex.message;
      }
    },
  }, [
    el('label', {}, 'Word'),
    text,
    el('label', {}, 'Meaning'),
    meaning,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [
      el('button', { class: 'btn', type: 'submit' }, 'Add'),
    ]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, `Add a ${language.name} word`), form]));
}
