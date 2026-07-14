// The "Games" page — embeds the word-games hub (Shooter, Memory Match, Word
// Fall, Labyrinth) that runs inside the World service in solo practice mode.
// The games draw on your flashcard decks and feed your review schedule.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';

export async function renderGames() {
  const view = clear(document.getElementById('view'));
  let base = null;
  try {
    ({ url: base } = await api.world());
  } catch {
    // Leave games unavailable rather than embedding a broken frame.
  }

  if (!base) {
    view.append(
      el('div', { class: 'world-bar' }, [
        el('div', {}, [
          el('strong', {}, 'Games'),
          el('span', { class: 'muted', style: 'margin-left:0.6rem; font-size:0.85rem' }, 'Word games are currently unavailable.'),
        ]),
      ])
    );
    return;
  }

  const query = `?mode=practice${store.user ? `&name=${encodeURIComponent(store.user.username)}` : ''}`;
  const src = `${base}${query}`;

  view.append(
    el('div', { class: 'world-bar' }, [
      el('div', {}, [
        el('strong', {}, 'Word games'),
        el('span', { class: 'muted', style: 'margin-left:0.6rem; font-size:0.85rem' }, 'Play with your own deck words — clear levels and boost your reviews.'),
      ]),
      el('div', { class: 'row', style: 'gap:0.5rem' }, [
        el('a', { class: 'btn small secondary', href: src, target: '_blank', rel: 'noopener' }, 'Open in new tab'),
      ]),
    ])
  );

  const frame = el('iframe', {
    class: 'world-frame',
    src,
    allow: 'fullscreen',
  });
  frame.addEventListener('load', () => frame.focus());
  frame.addEventListener('mouseenter', () => frame.focus());
  view.append(frame);
}
