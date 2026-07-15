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
    // Definitions — multiple candidate senses, upvotable, some accepted.
    box.append(el('div', { class: 'links-title' }, 'Definitions'));
    const defList = el('div', { class: 'definitions' });
    if (!data.definitions?.length) {
      defList.append(el('p', { class: 'muted' }, 'No definition yet.'));
    } else {
      for (const d of data.definitions) defList.append(definitionEl(d));
    }
    box.append(defList);
    if (store.user) {
      box.append(el('button', { class: 'btn small secondary', style: 'margin-top:0.5rem', onclick: () => openAddDefinition(data.word, langCode, defList) }, '+ Add definition'));
    }

    // Lemma: this word is an inflected form of another (e.g. "links" → "link").
    // Show the base word (clickable) and its real senses.
    if (data.lemma) {
      const lemLang = data.lemma.languageCode || langCode;
      box.append(
        el('div', { class: 'lemma-note' }, [
          'Inflected form of ',
          wordEl(data.lemma.text, lemLang),
        ])
      );
      if (data.lemma.definitions?.length) {
        const lemList = el('div', { class: 'definitions lemma-defs' });
        for (const d of data.lemma.definitions) lemList.append(definitionEl(d));
        box.append(lemList);
      }
    }

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

// Curated/external sources get a green source badge; user-written definitions
// show the author's name (not green).
const SOURCE_LABELS = { wiktionary: 'Wiktionary', wordnet: 'WordNet', concepticon: 'Concepticon', seed: 'Groupifier' };
function sourceBadge(d) {
  const label = SOURCE_LABELS[d.source];
  if (label) return el('span', { class: 'src-badge' }, label);
  if (d.author) return el('span', { class: 'src-user' }, `@${d.author}`);
  return null;
}

// Definitions/glosses are written in English (the sense-network's meta-language),
// so words inside them must tokenize as English — clicking "meeting" should go to
// the English word, not the foreign headword's language.
function glossLang() {
  return store.nativeLang.startsWith('en') ? store.nativeLang : 'en-US';
}

// One definition row: upvote control + text + source meta.
function definitionEl(d) {
  const count = el('span', {}, String(d.votes || 0));
  const up = el('button', { class: `vote-btn${d.voted ? ' voted' : ''}`, title: store.user ? 'Upvote' : 'Sign in to vote' }, [el('span', { class: 'vote-arrow' }, '▲'), count]);
  up.addEventListener('click', async () => {
    if (!store.user) return;
    up.disabled = true;
    try {
      const { voted, votes } = await api.voteDefinition(d.id);
      d.voted = voted; d.votes = votes;
      count.textContent = String(votes);
      up.classList.toggle('voted', voted);
    } catch { /* ignore */ } finally { up.disabled = false; }
  });
  return el('div', { class: 'definition' }, [
    up,
    el('div', { class: 'def-body' }, [
      el('span', { class: 'def-text', lang: glossLang() }, renderText(d.text, glossLang())),
      el('div', { class: 'def-meta muted' }, [
        sourceBadge(d),
        // Importance = how many cards/strings link to this sense (drives ordering).
        d.links ? el('span', { class: 'def-links', title: `${d.links} card${d.links === 1 ? '' : 's'} link here` }, `${d.links} link${d.links === 1 ? '' : 's'}`) : null,
      ]),
    ]),
  ]);
}

function openAddDefinition(word, langCode, defList) {
  const err = el('div', { class: 'error' });
  const input = el('input', { type: 'text', placeholder: 'a definition or translation' });
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        const { definition } = await api.addDefinition(word.id, { text: input.value });
        defList.querySelector('.muted')?.remove();
        defList.append(definitionEl(definition));
        close();
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [el('label', {}, 'Definition'), input, err, el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Add')])]);
  const close = openModal(el('div', {}, [el('h2', {}, `Define “${word.text}”`), form]));
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
  back.value = tr?.text || data.definitions?.[0]?.text || '';

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

  // Optional extra fields (Anki-style): example sentence, plural, audio URL, IPA…
  const exampleInput = el('input', { type: 'text', placeholder: 'example sentence' });
  const pluralInput = el('input', { type: 'text', placeholder: 'plural form' });
  const audioInput = el('input', { type: 'url', placeholder: 'audio URL (mp3/ogg)' });
  const moreFields = el('div', { class: 'more-fields', style: 'display:none' }, [
    el('label', {}, 'Example'), exampleInput,
    el('label', {}, 'Plural'), pluralInput,
    el('label', {}, 'Audio URL'), audioInput,
  ]);
  const moreToggle = el('button', {
    class: 'btn small link', type: 'button',
    onclick: () => { moreFields.style.display = moreFields.style.display === 'none' ? '' : 'none'; },
  }, '＋ more fields');

  const submit = el('button', { class: 'btn', type: 'submit' }, 'Add card');
  let allowDuplicate = false; // set true after the user confirms a duplicate

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      err.className = 'error';
      try {
        let deckId;
        if (deckSel.value === 'new') {
          const name = nameInput.value.trim() || `${languageName(langCode)} deck`;
          const { deck } = await api.createDeck({ languageCode: langCode, name });
          deckId = deck.id;
        } else {
          deckId = Number(deckSel.value);
        }
        const fields = {};
        if (exampleInput.value.trim()) fields.example = exampleInput.value.trim();
        if (pluralInput.value.trim()) fields.plural = pluralInput.value.trim();
        if (audioInput.value.trim()) fields.audio = audioInput.value.trim();
        await api.addCard(deckId, { front: data.text, back: back.value, allowDuplicate, fields });
        noteCardAdded(langCode, data.text);
        window.dispatchEvent(new Event('ls:decks-changed'));
        close();
      } catch (ex) {
        if (ex.status === 409 && ex.data?.duplicate) {
          // Already in the deck — warn and let them add a duplicate on purpose.
          err.className = 'muted';
          err.textContent = `${ex.message} Press “Add anyway” to add it again.`;
          allowDuplicate = true;
          submit.textContent = 'Add anyway';
        } else {
          err.textContent = ex.message;
        }
      }
    },
  }, [
    el('label', {}, 'Deck'), deckSel,
    nameWrap,
    el('label', {}, 'Front'), el('div', { class: 'muted', style: 'font-size:1.05rem' }, data.text),
    el('label', {}, 'Back'), back,
    moreToggle, moreFields,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [submit]),
  ]);
  // Changing the target deck resets the duplicate confirmation.
  deckSel.addEventListener('change', () => { allowDuplicate = false; submit.textContent = 'Add card'; err.textContent = ''; });

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
