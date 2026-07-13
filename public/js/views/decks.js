// Flashcard decks: list, import (CSV/TSV incl. Anki text export), study, delete.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { signInPrompt } from '../auth.js';

export async function renderDecks() {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, 'Flashcards'));

  if (!store.user) {
    view.append(el('p', {}, signInPrompt('to create and study decks.')));
    return;
  }

  view.append(
    el('div', { class: 'section-head' }, [
      el('span', { class: 'muted' }, 'Your decks — studying them turns those words greener in “Studied” colour mode.'),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn small secondary', title: 'Practise your deck words as a quick arcade game', onclick: () => openWordGame() }, '🎯 Word game'),
        el('button', { class: 'btn small secondary', onclick: () => openGenerate(() => renderDecks()) }, '✨ Generate (AI)'),
        el('button', { class: 'btn small', onclick: () => openImport(() => renderDecks()) }, '+ Import deck'),
      ]),
    ])
  );

  const list = el('div', {});
  view.append(list);
  list.append(el('p', { class: 'muted' }, 'Loading…'));

  const { decks } = await api.decks();
  window.dispatchEvent(new Event('ls:decks-changed'));
  clear(list);
  if (!decks.length) {
    list.append(el('p', { class: 'muted' }, 'No decks yet. Import a CSV, or an Anki “Notes in Plain Text” (TSV) export.'));
    return;
  }

  // Study everything due across all decks in one session.
  const totalDue = decks.reduce((s, d) => s + (d.due || 0), 0);
  if (totalDue > 0) {
    list.append(
      el('div', { class: 'study-all-bar' }, [
        el('span', {}, `${totalDue} card${totalDue === 1 ? '' : 's'} due across your decks.`),
        el('a', { class: 'btn small', href: '#/study' }, `Study all (${totalDue})`),
      ])
    );
  }

  for (const d of decks) {
    list.append(
      el('div', { class: 'card deck-card' }, [
        el('div', { class: 'card-top' }, [
          el('div', {}, [
            el('strong', {}, d.name),
            el('div', { class: 'muted', style: 'font-size:0.82rem' }, `${d.lang_name} · ${d.total} cards · ${d.due} due`),
          ]),
          el('div', { class: 'row' }, [
            d.due > 0
              ? el('a', { class: 'btn small', href: `#/study/${d.id}` }, `Study (${d.due})`)
              : el('span', { class: 'muted', style: 'font-size:0.82rem' }, 'All caught up'),
            d.total > 0
              ? el('a', { class: 'btn small secondary', href: `/api/flashcards/decks/${d.id}/export?format=anki`, download: '', title: 'Download as Anki text (.txt)' }, 'Anki')
              : null,
            d.total > 0
              ? el('a', { class: 'btn small secondary', href: `/api/flashcards/decks/${d.id}/export?format=csv`, download: '', title: 'Download as CSV' }, 'CSV')
              : null,
            el('button', { class: 'btn small secondary', onclick: () => removeDeck(d) }, 'Delete'),
          ]),
        ]),
      ])
    );
  }

  function removeDeck(d) {
    const close = openModal(el('div', {}, [
      el('h2', {}, `Delete ${d.name}?`),
      el('p', { class: 'muted' }, 'This removes the deck and its cards.'),
      el('div', { class: 'row', style: 'justify-content:flex-end; margin-top:1rem' }, [
        el('button', { class: 'btn small secondary', type: 'button', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn small danger', type: 'button', onclick: async () => { try { await api.deleteDeck(d.id); } catch { /* ignore */ } close(); renderDecks(); } }, 'Delete'),
      ]),
    ]));
  }
}

// Open the solo Word game (runs in the World service, deep-linked to practice
// mode). Practice reads the signed-in user's decks via the same-origin cookie.
async function openWordGame() {
  let base = null;
  try { ({ url: base } = await api.world()); } catch { /* unavailable */ }
  if (!base) {
    const close = openModal(el('div', {}, [
      el('h2', {}, 'Word game'),
      el('p', { class: 'muted' }, 'The game runs in the World, which is currently unavailable. Try again shortly.'),
      el('div', { class: 'row', style: 'justify-content:flex-end' }, [
        el('button', { class: 'btn small', onclick: () => close() }, 'OK'),
      ]),
    ]));
    return;
  }
  window.open(`${base}?mode=practice`, '_blank', 'noopener');
}

// Generate a starter deck from the most frequent words, auto-translated by the
// local AI model.
function openGenerate(onDone) {
  const err = el('div', { class: 'error' });
  const langSel = el('select', {}, store.languages.map((l) => el('option', { value: l.code }, l.name)));
  const backSel = el('select', {}, store.languages.map((l) => el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.name)));
  const count = el('input', { type: 'number', value: '30', min: '1', max: '100', style: 'max-width:100px' });
  const submit = el('button', { class: 'btn', type: 'submit' }, 'Generate deck');
  const status = el('div', { class: 'muted' });

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      submit.disabled = true;
      status.textContent = 'Generating… the first run downloads the translation model (~1 min), then it\'s fast.';
      try {
        const { deck, added } = await api.generateDeck({
          languageCode: langSel.value, backLanguageCode: backSel.value, count: Number(count.value),
        });
        close();
        onDone();
      } catch (ex) {
        err.textContent = ex.message;
        submit.disabled = false;
        status.textContent = '';
      }
    },
  }, [
    el('label', {}, 'Language to learn (front)'), langSel,
    el('label', {}, 'Translate to (back)'), backSel,
    el('label', {}, 'How many words'), count,
    el('div', { class: 'muted', style: 'font-size:0.78rem; margin-top:0.3rem' }, 'Takes the most frequent words and translates each with the on-device AI model. Great as a beginner deck.'),
    err, status,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [submit]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, 'Generate a deck (AI)'), form]));
}

function openImport(onDone) {
  const err = el('div', { class: 'error' });
  const name = el('input', { type: 'text', placeholder: 'deck name' });
  const langSel = el('select', {}, store.languages.map((l) => el('option', { value: l.code }, l.name)));
  const text = el('textarea', {
    placeholder: 'Paste CSV or TSV — front,back per line:\nHallo,hello\nDanke,thank you',
    style: 'min-height:150px; font-family:ui-monospace, monospace;',
  });
  const file = el('input', { type: 'file', accept: '.csv,.tsv,.txt,.apkg' });
  let apkgFile = null;
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    if (!name.value) name.value = f.name.replace(/\.[^.]+$/, '');
    if (f.name.toLowerCase().endsWith('.apkg')) {
      apkgFile = f;
      text.value = '';
      text.disabled = true;
      text.placeholder = `Anki package “${f.name}” selected — click Import.`;
    } else {
      apkgFile = null;
      text.disabled = false;
      try { text.value = await f.text(); } catch { err.textContent = 'could not read file'; }
    }
  });

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        if (apkgFile) {
          const bytes = new Uint8Array(await apkgFile.arrayBuffer());
          let bin = '';
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          await api.importApkg({ languageCode: langSel.value, name: name.value, data: btoa(bin) });
        } else {
          await api.importDeck({ languageCode: langSel.value, name: name.value, text: text.value, source: 'csv' });
        }
        close();
        onDone();
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [
    el('label', {}, 'Deck name'), name,
    el('label', {}, 'Language of the words (front)'), langSel,
    el('label', {}, 'Paste CSV / TSV'), text,
    el('label', {}, '…or choose a file (CSV, TSV, or Anki .apkg)'), file,
    el('div', { class: 'muted', style: 'font-size:0.78rem; margin-top:0.3rem' },
      'Two columns: front (the word) then back (meaning/translation). Anki: a .apkg export works, or File → Export → “Notes in Plain Text”.'),
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Import')]),
  ]);

  const close = openModal(el('div', { class: 'import-modal' }, [el('h2', {}, 'Import a deck'), form]));
}
