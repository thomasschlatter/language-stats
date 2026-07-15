// Turn any bullet/numbered list in rendered article or tip markup into a
// flashcard deck. For every list in `container`, a small "Make a flashcard deck"
// button is added; clicking it splits each item into front/back and creates a
// deck for the learner.
//
// Item → card: the text is split on the first separator it contains, in order
//   TAB · " — " · " – " · " | " · " = " · " :: " · " - " · ": "
// Left of the separator is the FRONT (the term), right is the BACK (the answer).
// An item with no separator becomes a front-only card.

import { api } from '../api.js';
import { store } from '../store.js';
import { el } from '../dom.js';

const SEPARATORS = ['\t', ' — ', ' – ', ' | ', ' = ', ' :: ', ' - ', ': '];

function splitCard(text) {
  const t = text.trim().replace(/\s+/g, ' ');
  for (const sep of SEPARATORS) {
    const i = t.indexOf(sep);
    if (i > 0) return { front: t.slice(0, i).trim(), back: t.slice(i + sep.length).trim() };
  }
  return { front: t, back: '' };
}

// The deck name: the nearest heading above the list, else the supplied fallback.
function deckNameFor(listEl, fallback) {
  let p = listEl.previousElementSibling;
  while (p) {
    if (/^H[1-6]$/.test(p.tagName) && p.textContent.trim()) return p.textContent.trim();
    p = p.previousElementSibling;
  }
  return fallback;
}

// Attach a deck button to every list in `container`. `languageCode` is the
// language the cards belong to; `fallbackName` names decks from unlabelled lists.
export function attachDeckButtons(container, languageCode, fallbackName) {
  if (!store.user) return; // deck creation needs an account
  // Anki lists get their own richer button (attachAnkiButtons); skip them here.
  const lists = container.querySelectorAll('ul.article-ul:not(.anki-list), ol.article-ol:not(.anki-list)');
  for (const list of lists) {
    const items = [...list.querySelectorAll(':scope > li')];
    if (items.length < 2) continue; // not worth a deck

    const status = el('span', { class: 'list-deck-status' });
    const btn = el('button', { class: 'btn small secondary list-deck-btn' }, '🃏 Make a flashcard deck');
    const bar = el('div', { class: 'list-deck-bar' }, [btn, status]);
    list.after(bar);

    btn.addEventListener('click', async () => {
      const rows = items.map((li) => splitCard(li.textContent)).filter((c) => c.front);
      if (!rows.length) { status.textContent = 'Nothing to add.'; return; }
      btn.disabled = true;
      status.textContent = 'Creating…';
      status.className = 'list-deck-status';
      try {
        const text = rows.map((r) => `${r.front}\t${r.back}`).join('\n');
        const { deck, added } = await api.importDeck({
          languageCode,
          name: deckNameFor(list, fallbackName),
          text,
          source: 'list',
        });
        bar.replaceChildren(
          el('span', { class: 'list-deck-status ok' }, `✓ Added ${added} card${added === 1 ? '' : 's'} to “${deck.name}”. `),
          el('a', { href: '#/decks', class: 'list-deck-link' }, 'Study now →')
        );
        window.dispatchEvent(new CustomEvent('ls:decks-changed'));
      } catch (ex) {
        btn.disabled = false;
        status.textContent = ex.message || 'Could not create deck.';
        status.className = 'list-deck-status err';
      }
    });
  }
}

// Richer buttons for [anki] lists: add as a NEW deck, or append to an existing
// deck ("add to another list"). Cards auto-link to dictionary senses server-side.
export async function attachAnkiButtons(container, languageCode, fallbackName) {
  if (!store.user) return;
  const lists = container.querySelectorAll('ul.anki-list, ol.anki-list');
  if (!lists.length) return;
  let myDecks = [];
  try { ({ decks: myDecks } = await api.decks()); } catch { /* offline */ }

  for (const list of lists) {
    const items = [...list.querySelectorAll(':scope > li')];
    if (!items.length) continue;
    const rowsOf = () => items.map((li) => splitCard(li.textContent)).filter((c) => c.front);
    const name = list.getAttribute('data-deck-name') || deckNameFor(list, fallbackName);

    const status = el('span', { class: 'list-deck-status' });
    const newBtn = el('button', { class: 'btn small' }, '🃏 Add as new deck');
    const addTo = el('select', { class: 'anki-add-to' }, [
      el('option', { value: '' }, '＋ Add to a deck…'),
      ...myDecks.filter((d) => d.lang === languageCode).map((d) => el('option', { value: String(d.id) }, d.name)),
    ]);
    const bar = el('div', { class: 'list-deck-bar anki-bar' }, [newBtn, addTo, status]);
    list.after(bar);

    const done = (added, deckName, deckId) => {
      bar.replaceChildren(
        el('span', { class: 'list-deck-status ok' }, `✓ Added ${added} card${added === 1 ? '' : 's'} to “${deckName}”. `),
        el('a', { href: '#/decks', class: 'list-deck-link' }, 'Study now →')
      );
      window.dispatchEvent(new CustomEvent('ls:decks-changed'));
    };

    newBtn.addEventListener('click', async () => {
      const rows = rowsOf();
      if (!rows.length) { status.textContent = 'Nothing to add.'; return; }
      newBtn.disabled = true; status.textContent = 'Creating…'; status.className = 'list-deck-status';
      try {
        const text = rows.map((r) => `${r.front}\t${r.back}`).join('\n');
        const { deck, added } = await api.importDeck({ languageCode, name, text, source: 'anki-list' });
        done(added, deck.name, deck.id);
      } catch (ex) { newBtn.disabled = false; status.textContent = ex.message; status.className = 'list-deck-status err'; }
    });

    addTo.addEventListener('change', async () => {
      const deckId = addTo.value;
      if (!deckId) return;
      const rows = rowsOf();
      if (!rows.length) { status.textContent = 'Nothing to add.'; return; }
      addTo.disabled = true; status.textContent = 'Adding…'; status.className = 'list-deck-status';
      try {
        const { added } = await api.appendCards(deckId, rows);
        const dname = myDecks.find((d) => String(d.id) === deckId)?.name || 'deck';
        done(added, dname, deckId);
      } catch (ex) { addTo.disabled = false; status.textContent = ex.message; status.className = 'list-deck-status err'; }
    });
  }
}
