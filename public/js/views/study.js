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
    window.dispatchEvent(new Event('ls:decks-changed'));
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
    const senses = senseControls(card);
    senses.style.display = 'none';
    const rateRow = el('div', { class: 'rate-row' }, [
      el('button', { class: 'btn small danger', onclick: () => rate(1) }, 'Again'),
      el('button', { class: 'btn small secondary', onclick: () => rate(2) }, 'Hard'),
      el('button', { class: 'btn small', onclick: () => rate(3) }, 'Good'),
      el('button', { class: 'btn small secondary', onclick: () => rate(4) }, 'Easy'),
    ]);
    rateRow.style.display = 'none';
    const show = el('button', {
      class: 'btn',
      onclick: () => { back.style.display = ''; senses.style.display = ''; show.style.display = 'none'; rateRow.style.display = ''; },
    }, 'Show answer');

    stage.append(el('div', { class: 'flash-card' }, [
      el('div', { class: 'flash-count muted' }, `${queue.length} due`),
      el('div', { class: 'flash-front' }, card.front),
      back,
      senses,
      show,
      rateRow,
    ]));
  }
}

// Collapsible sense picker: shows the word's ranked dictionary senses, lets the
// learner re-link this card to a different one (self-updating), and links out to
// the word page to add/upvote senses.
function senseControls(card) {
  const lang = store.languages.find((l) => l.id === card.language_id);
  const langCode = lang?.code || store.nativeLang;
  const toggle = el('button', { class: 'btn small link sense-toggle' }, 'senses ▾');
  const panel = el('div', { class: 'sense-panel', style: 'display:none' });
  let defs = null;

  const renderRows = () => {
    panel.replaceChildren();
    for (const d of (defs || [])) {
      const linked = card.definition_id === d.id;
      const row = el('button', { class: 'sense-row' + (linked ? ' linked' : '') }, [
        el('span', {}, (linked ? '● ' : '○ ') + d.text),
        d.links ? el('span', { class: 'def-links' }, ` ${d.links}`) : null,
      ]);
      row.addEventListener('click', async () => {
        try { await api.relinkCardSense(card.id, d.id); card.definition_id = d.id; renderRows(); } catch { /* ignore */ }
      });
      panel.append(row);
    }
    panel.append(el('a', {
      href: `#/w/${encodeURIComponent(langCode)}/${encodeURIComponent(card.front)}`,
      class: 'muted', style: 'font-size:0.78rem; display:inline-block; margin-top:0.3rem',
    }, 'add / upvote senses on the word page →'));
  };

  toggle.addEventListener('click', async () => {
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : '';
    toggle.textContent = open ? 'senses ▾' : 'senses ▲';
    if (!open && defs === null) {
      panel.append(el('span', { class: 'muted' }, 'Loading…'));
      try { const data = await api.entry(langCode, card.front); defs = data.definitions || []; renderRows(); }
      catch { defs = []; panel.replaceChildren(el('span', { class: 'error' }, 'Could not load senses.')); }
    }
  });

  return el('div', { class: 'sense-controls' }, [toggle, panel]);
}
