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
  const lists = container.querySelectorAll('ul.article-ul, ol.article-ol');
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
