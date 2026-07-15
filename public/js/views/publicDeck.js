// Full view of a shared deck: every card listed, with upvote + add-to-my-decks.
import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { navigate } from '../router.js';
import { genCoverEl } from '../deckCover.js';
import { iconEl } from '../icons.js';

export async function renderPublicDeck(id) {
  const view = clear(document.getElementById('view'));
  view.append(el('a', { class: 'muted', href: '#/decks/browse', style: 'display:inline-block; margin-bottom:0.8rem' }, '← Shared decks'));
  const head = el('div', {});
  const listWrap = el('div', {});
  view.append(head, listWrap);
  listWrap.append(el('p', { class: 'muted' }, 'Loading…'));

  try {
    const [{ deck }, { cards }] = await Promise.all([api.publicDeck(id), api.publicDeckCards(id)]);
    clear(head).append(
      deck.cover_url
        ? el('img', { class: 'deck-cover deck-cover-lg', src: deck.cover_url, alt: '' })
        : genCoverEl(deck, { large: true }),
      el('h1', { style: 'margin-bottom:0.2rem' }, deck.name),
      el('div', { class: 'muted', style: 'font-size:0.9rem' }, [
        deck.is_official ? el('span', { class: 'badge official' }, 'Official') : el('span', { class: 'badge user' }, `@${deck.author || 'user'}`),
        ` · ${deck.lang_name} · ${deck.total} cards${deck.level ? ' · ' + deck.level.toUpperCase() : ''}`,
      ]),
      el('div', { class: 'row', style: 'gap:0.6rem; margin:0.9rem 0 1.2rem' }, [
        voteBtn(deck),
        store.user
          ? el('button', { class: 'btn', onclick: (e) => addToMine(deck, e.currentTarget) }, '+ Add to my decks')
          : el('span', { class: 'muted' }, 'Sign in to add this deck.'),
      ]),
    );

    clear(listWrap);
    const table = el('div', { class: 'deck-preview-list deck-full-list' });
    for (const c of cards) {
      table.append(el('div', { class: 'deck-preview-row' }, [
        // Front word links to its dictionary page (like clickable words in tips).
        el('a', { class: 'dp-front', href: `#/w/${encodeURIComponent(deck.lang)}/${encodeURIComponent(c.front)}` }, c.front),
        backCell(c, deck.lang),
      ]));
    }
    listWrap.append(table);
  } catch (ex) {
    clear(listWrap).append(el('p', { class: 'error' }, ex.message));
  }
}

// The meaning cell: a linked dictionary sense (live, marked with a link glyph +
// clickable to the word page) or a plain, greyed static string.
function backCell(c, lang) {
  if (c.definition_id) {
    const text = c.sense_text || c.back || '';
    return el('a', {
      class: 'dp-back dp-linked',
      href: `#/w/${encodeURIComponent(lang)}/${encodeURIComponent(c.front)}`,
      title: `Linked dictionary sense · ${c.sense_votes || 0} upvote${c.sense_votes === 1 ? '' : 's'}`,
    }, [text, iconEl('link')]);
  }
  return el('span', { class: 'dp-back muted' }, c.back || '');
}

function voteBtn(d) {
  const btn = el('button', { class: `vote-btn${d.voted ? ' voted' : ''}`, title: 'Upvote' }, `▲ ${d.votes}`);
  btn.addEventListener('click', async () => {
    if (!store.user) { navigate('#/'); return; }
    btn.disabled = true;
    try {
      const { voted, votes } = await api.voteDeck(d.id);
      d.voted = voted; d.votes = votes;
      btn.textContent = `▲ ${votes}`;
      btn.classList.toggle('voted', voted);
    } catch { /* ignore */ } finally { btn.disabled = false; }
  });
  return btn;
}

async function addToMine(d, btn) {
  if (btn.dataset.added) { navigate('#/decks'); return; }
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    await api.copyDeck(d.id);
    btn.dataset.added = '1';
    btn.textContent = '✓ Added — go to My decks';
    btn.disabled = false;
  } catch (ex) {
    btn.textContent = '+ Add to my decks';
    btn.disabled = false;
    alert(ex.message);
  }
}
