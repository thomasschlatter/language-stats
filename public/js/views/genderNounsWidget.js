// The [gender-nouns] widget: pick a coverage level (50 / 75 / 90 / 95 %), see a
// PREVIEW of the nouns whose gender can't be guessed from the ending at that
// level, and build a flashcard deck from the COMPLETE live list on the server.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { tokenizeTree } from '../render.js';
import { signInPrompt } from '../auth.js';

const LEVELS = [0.5, 0.75, 0.9, 0.95];
const PREVIEW = 12;

export function genderNounsWidget(langCode) {
  const wrap = el('div', { class: 'coverage gender-nouns' });
  const btnRow = el('div', { class: 'coverage-btns' });
  const result = el('div', { class: 'coverage-result' });
  const buttons = new Map();

  for (const t of LEVELS) {
    const b = el('button', { class: 'btn small secondary', onclick: () => select(t) }, `${Math.round(t * 100)}%`);
    buttons.set(t, b);
    btnRow.append(b);
  }
  wrap.append(
    el('div', { class: 'coverage-title' },
      'Nouns whose gender you can’t guess from the ending. Pick how much of everyday conversation to cover, then build a deck of the whole set:'),
    btnRow,
    result
  );

  async function select(t) {
    for (const [lvl, b] of buttons) b.classList.toggle('active', lvl === t);
    clear(result).append(el('span', { class: 'muted' }, 'Loading…'));
    let nouns;
    try {
      ({ nouns } = await api.genderNouns(langCode, t));
    } catch (ex) {
      clear(result).append(el('p', { class: 'error' }, ex.message));
      return;
    }
    clear(result);
    if (!nouns.length) {
      result.append(el('p', { class: 'muted' },
        'No unguessable-gender nouns at this coverage level — try a higher % (or this language has no gender data yet).'));
      return;
    }

    const preview = nouns.slice(0, PREVIEW);
    const list = el('ul', { class: 'article-ul gender-noun-list' },
      preview.map((n) =>
        el('li', {}, [
          el('span', { lang: langCode }, n.word),
          ` — ${n.article}${n.meaning ? ` (${n.meaning})` : ''}`,
        ])
      )
    );
    const more = nouns.length > PREVIEW
      ? el('p', { class: 'muted', style: 'margin:0.2rem 0 0.6rem' }, `…and ${nouns.length - PREVIEW} more.`)
      : null;

    const status = el('span', { class: 'list-deck-status' });
    const btn = el('button', { class: 'btn small' },
      `🃏 Generate flashcard deck (${nouns.length} cards)`);
    const bar = store.user
      ? el('div', { class: 'list-deck-bar' }, [btn, status])
      : el('div', { class: 'list-deck-bar' }, signInPrompt('to build this deck'));

    result.append(list, more, bar);
    tokenizeTree(list);

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      status.textContent = 'Generating from the full list…';
      status.className = 'list-deck-status';
      try {
        // The server rebuilds the complete list at this level — not the preview.
        const { deck, added } = await api.genderDeck({ languageCode: langCode, t });
        bar.replaceChildren(
          el('span', { class: 'list-deck-status ok' }, `✓ Created “${deck.name}” with ${added} cards. `),
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

  select(0.9); // default to a level where nouns are plentiful
  return wrap;
}
