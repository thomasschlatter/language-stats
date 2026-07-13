// The [gender-nouns] widget: shows a short PREVIEW of the nouns whose gender
// can't be guessed from their ending, and a button that builds a flashcard deck
// from the COMPLETE, live list on the server (not just what's shown here).

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { tokenizeTree } from '../render.js';
import { signInPrompt } from '../auth.js';

const PREVIEW = 12;

export function genderNounsWidget(langCode) {
  const wrap = el('div', { class: 'coverage gender-nouns' });
  wrap.append(
    el('div', { class: 'coverage-title' },
      'Nouns whose gender you can’t guess from the ending — a preview from the real frequency data:')
  );
  const body = el('div', {}, el('span', { class: 'muted' }, 'Loading…'));
  wrap.append(body);

  api.genderNouns(langCode, 1, 500)
    .then(({ nouns }) => {
      clear(body);
      if (!nouns.length) {
        body.append(el('p', { class: 'muted' }, 'No gender data for this language yet.'));
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

      body.append(list, more, bar);
      tokenizeTree(list);

      btn.addEventListener('click', async () => {
        btn.disabled = true;
        status.textContent = 'Generating from the full list…';
        status.className = 'list-deck-status';
        try {
          // The server rebuilds the complete list from live data — not the preview.
          const { deck, added } = await api.genderDeck({ languageCode: langCode });
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
    })
    .catch((ex) => {
      clear(body).append(el('p', { class: 'error' }, ex.message));
    });

  return wrap;
}
