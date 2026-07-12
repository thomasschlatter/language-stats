// Study a deck: go through due cards, reveal the answer, and rate recall.
// Ratings drive the SRS scheduler (1 again, 2 hard, 3 good, 4 easy).

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';

export async function renderStudy(deckId) {
  const view = clear(document.getElementById('view'));
  if (!store.user) {
    view.append(el('p', { class: 'muted' }, 'Sign in to study.'));
    return;
  }
  view.append(el('a', { href: '#/decks', class: 'muted' }, '← Decks'));
  const stage = el('div', { class: 'study-stage' });
  view.append(stage);

  let queue = [];
  try {
    ({ cards: queue } = await api.study(deckId));
  } catch (ex) {
    stage.append(el('p', { class: 'error' }, ex.message));
    return;
  }
  render();

  async function rate(r) {
    const card = queue.shift();
    try { await api.review({ cardId: card.id, rating: r }); } catch { /* ignore */ }
    if (r === 1) queue.push(card); // relearn again this session
    render();
  }

  function render() {
    clear(stage);
    if (!queue.length) {
      stage.append(el('div', { class: 'study-done' }, [
        el('h2', {}, 'All done! 🎉'),
        el('p', { class: 'muted' }, 'No more cards due right now.'),
        el('a', { class: 'btn', href: '#/decks' }, 'Back to decks'),
      ]));
      return;
    }
    const card = queue[0];
    const back = el('div', { class: 'flash-back' }, card.back || '—');
    back.style.display = 'none';
    const rateRow = el('div', { class: 'rate-row' }, [
      el('button', { class: 'btn small danger', onclick: () => rate(1) }, 'Again'),
      el('button', { class: 'btn small secondary', onclick: () => rate(2) }, 'Hard'),
      el('button', { class: 'btn small', onclick: () => rate(3) }, 'Good'),
      el('button', { class: 'btn small secondary', onclick: () => rate(4) }, 'Easy'),
    ]);
    rateRow.style.display = 'none';
    const show = el('button', {
      class: 'btn',
      onclick: () => { back.style.display = ''; show.style.display = 'none'; rateRow.style.display = ''; },
    }, 'Show answer');

    stage.append(el('div', { class: 'flash-card' }, [
      el('div', { class: 'flash-count muted' }, `${queue.length} due`),
      el('div', { class: 'flash-front' }, card.front),
      back,
      show,
      rateRow,
    ]));
  }
}
