// The page you land on when you click a word: it shows the word (with its
// locale), its monolingual definition (itself fully clickable), and its
// translations/links into other locales (each clickable). If the word isn't in
// the dictionary yet, signed-in users can add it. Words can be linked here too.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { renderText, wordEl, tokenizeTree } from '../render.js';
import { signInPrompt } from '../auth.js';
import { noteCardAdded } from '../seen.js';
import { navigate } from '../router.js';

export async function renderWordPage(langCode, text) {
  const view = clear(document.getElementById('view'));
  view.append(el('p', { class: 'muted' }, 'Loading…'));

  let data;
  try {
    data = await api.entry(langCode, text);
  } catch (ex) {
    clear(view).append(el('p', { class: 'error' }, ex.message));
    return;
  }

  clear(view);
  const box = el('div', { class: 'word-detail' });
  const langName = languageName(langCode);

  // Headword — the word itself (also clickable, so it can translate).
  box.append(
    el('div', { class: 'lang-tag' }, langName),
    el('h1', { class: 'headword' }, wordEl(data.text, langCode))
  );

  if (data.word) {
    // Definition (monolingual, in this word's own locale) — fully clickable.
    box.append(
      el('div', { class: 'meaning' },
        data.word.meaning
          ? renderText(data.word.meaning, langCode)
          : el('span', { class: 'muted' }, 'No definition yet.'))
    );

    // Translations & links
    box.append(el('div', { class: 'links-title' }, 'Translations & links'));
    const list = el('div', { class: 'links' });
    if (!data.links.length) {
      list.append(el('span', { class: 'muted' }, 'No links yet.'));
    } else {
      for (const l of data.links) {
        list.append(
          el('div', { class: 'link-row' }, [
            el('span', { class: 'link-type' }, l.type),
            wordEl(l.text, l.language_code),
            el('span', { class: 'lang-mini' }, l.language_code),
          ])
        );
      }
    }
    box.append(list);
  } else {
    // Word not in the dictionary yet.
    box.append(
      el('p', { class: 'muted' }, [
        `“${data.text}” isn't in the dictionary as a ${langName} word yet.`,
      ])
    );
  }

  // Progress controls (signed-in users): mark this word known / learning.
  if (store.user) {
    box.append(progressControls(langCode, data.text));
    box.append(
      el('div', { class: 'row', style: 'margin-top:0.75rem' }, [
        el('button', { class: 'btn small', onclick: () => openAddToDeck(langCode, data) }, '＋ Add to flashcards'),
        !data.word &&
          el('button', { class: 'btn small secondary', onclick: () => addEntry(langCode, data.text) }, `+ Add as ${langName} word`),
        el('button', { class: 'btn small secondary', onclick: () => addLink(langCode, data.text) }, '+ Add translation / link'),
      ])
    );
  } else {
    box.append(el('p', { style: 'margin-top:1rem' }, signInPrompt('to track this word, add or link words.')));
  }

  view.append(box);
  // Make every remaining piece of text on the page clickable too.
  tokenizeTree(view);
}

function languageName(code) {
  return store.languages.find((l) => l.code === code)?.name || code;
}

// "I know this" / "Learning" toggle for a word, reflecting saved status.
function progressControls(langCode, text) {
  const wrap = el('div', { class: 'progress-controls row', style: 'margin-top:1.25rem' });
  const label = el('span', { class: 'muted' }, 'Your progress:');
  const known = el('button', { class: 'btn small secondary' }, '✓ I know this');
  const learning = el('button', { class: 'btn small secondary' }, '◐ Learning');
  wrap.append(label, known, learning);

  let current = 'none';
  const paint = () => {
    known.classList.toggle('active', current === 'known');
    learning.classList.toggle('active', current === 'learning');
  };
  const set = async (status) => {
    const next = current === status ? 'none' : status; // click again to clear
    try {
      await api.markWord({ languageCode: langCode, word: text, status: next });
      current = next;
      paint();
    } catch { /* ignore */ }
  };
  known.addEventListener('click', () => set('known'));
  learning.addEventListener('click', () => set('learning'));

  // Load existing status.
  api.wordProgress(langCode, text).then((r) => { current = r.status; paint(); }).catch(() => {});
  return wrap;
}

// Add this word to a flashcard deck (existing or new).
async function openAddToDeck(langCode, data) {
  const err = el('div', { class: 'error' });
  const nativeBase = store.nativeLang.split('-')[0];
  const tr = (data.links || []).find(
    (l) => l.type === 'translation' && (l.language_code === store.nativeLang || l.language_code.split('-')[0] === nativeBase)
  );
  const back = el('input', { type: 'text', placeholder: 'meaning / translation' });
  back.value = tr?.text || data.word?.meaning || '';

  const deckSel = el('select', {});
  const nameInput = el('input', { type: 'text', placeholder: 'new deck name' });
  const nameWrap = el('div', {}, [el('label', {}, 'New deck name'), nameInput]);

  let decks = [];
  try { ({ decks } = await api.decks()); } catch { /* ignore */ }
  const langDecks = decks.filter((d) => d.lang === langCode);
  deckSel.append(
    ...langDecks.map((d) => el('option', { value: String(d.id) }, `${d.name} (${d.total})`)),
    el('option', { value: 'new' }, '＋ Create new deck')
  );
  if (!langDecks.length) deckSel.value = 'new';
  const syncName = () => { nameWrap.style.display = deckSel.value === 'new' ? '' : 'none'; };
  deckSel.addEventListener('change', syncName);
  syncName();

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        let deckId;
        if (deckSel.value === 'new') {
          const name = nameInput.value.trim() || `${languageName(langCode)} deck`;
          const { deck } = await api.createDeck({ languageCode: langCode, name });
          deckId = deck.id;
        } else {
          deckId = Number(deckSel.value);
        }
        await api.addCard(deckId, { front: data.text, back: back.value });
        noteCardAdded(langCode, data.text);
        window.dispatchEvent(new Event('ls:decks-changed'));
        close();
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [
    el('label', {}, 'Deck'), deckSel,
    nameWrap,
    el('label', {}, 'Front'), el('div', { class: 'muted', style: 'font-size:1.05rem' }, data.text),
    el('label', {}, 'Back'), back,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Add card')]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, `Add “${data.text}” to a deck`), form]));
}

// Create the (locale, text) entry with an optional definition.
function addEntry(langCode, text) {
  const err = el('div', { class: 'error' });
  const meaning = el('input', { type: 'text', placeholder: `definition in ${languageName(langCode)} (optional)` });
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        await api.createWord({ languageCode: langCode, text, meaning: meaning.value || undefined });
        close();
        renderWordPage(langCode, text);
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [el('label', {}, 'Definition'), meaning, err,
     el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Add')])]);
  const close = openModal(el('div', {}, [el('h2', {}, `Add “${text}”`), form]));
}

// Link this word to another word in some locale (creating both as needed).
function addLink(langCode, text) {
  const err = el('div', { class: 'error' });
  const langSelect = el('select', {}, store.languages.map((l) => el('option', { value: l.code }, l.name)));
  const target = el('input', { type: 'text', placeholder: 'the translated / related word' });
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
        // Ensure the source word exists, then link it to the target.
        const { word } = await api.createWord({ languageCode: langCode, text });
        await api.linkWord(word.id, {
          targetLanguageCode: langSelect.value,
          targetText: target.value,
          type: type.value,
        });
        close();
        renderWordPage(langCode, text);
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [
    el('label', {}, 'Target locale'), langSelect,
    el('label', {}, 'Word'), target,
    el('label', {}, 'Link type'), type,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Link')]),
  ]);
  const close = openModal(el('div', {}, [el('h2', {}, `Link “${text}”`), form]));
}
