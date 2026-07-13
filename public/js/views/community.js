// Community: browse and match language partners. Filter by the language a
// member speaks (native) and/or is learning, search by name, and follow.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { avatarFor } from '../avatar.js';
import { navigate } from '../router.js';

export async function renderCommunity() {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, 'Community'));
  view.append(el('p', { class: 'muted', style: 'margin-top:-0.5rem' }, 'Find people to practise with. Match on the language you’re learning.'));

  const langOptions = (placeholder) =>
    el('select', {}, [el('option', { value: '' }, placeholder), ...store.languages.map((l) => el('option', { value: l.code }, l.name))]);
  const speaks = langOptions('Speaks (any)');
  const learning = langOptions('Learning (any)');
  const q = el('input', { type: 'search', placeholder: 'search @username', style: 'max-width:200px' });

  const controls = el('div', { class: 'row', style: 'margin:1rem 0; gap:0.5rem' }, [
    speaks, learning, q,
    el('button', { class: 'btn small', onclick: () => load() }, 'Search'),
    store.user ? el('button', { class: 'btn small secondary', onclick: () => matchMe() }, 'Find my partners') : null,
  ]);
  view.append(controls);

  const grid = el('div', { class: 'card-grid' });
  view.append(grid);
  const moreWrap = el('div', { style: 'margin-top:1rem; text-align:center' });
  view.append(moreWrap);

  let baseParams = {};
  let offset = 0;

  async function fetchPage(append) {
    clear(moreWrap);
    if (!append) clear(grid).append(el('span', { class: 'muted' }, 'Loading…'));
    else moreWrap.append(el('span', { class: 'muted' }, 'Loading…'));
    try {
      const { people, hasMore } = await api.community({ ...baseParams, offset });
      if (!append) clear(grid);
      clear(moreWrap);
      if (!append && !people.length) { grid.append(el('p', { class: 'muted' }, 'No members match. Try widening the filters.')); return; }
      for (const p of people) grid.append(personCard(p));
      offset += people.length;
      if (hasMore) moreWrap.append(el('button', { class: 'btn secondary', onclick: () => fetchPage(true) }, 'Load more'));
    } catch (ex) {
      clear(moreWrap);
      if (!append) clear(grid).append(el('p', { class: 'error' }, ex.message));
    }
  }

  function load(params) {
    baseParams = params ?? { speaks: speaks.value, learning: learning.value, q: q.value };
    offset = 0;
    fetchPage(false);
  }

  function matchMe() {
    speaks.value = '';
    learning.value = '';
    q.value = '';
    load({ match: 1 });
  }

  load({});
}

function personCard(p) {
  const langs = (label, arr) =>
    arr.length ? el('div', { class: 'muted', style: 'font-size:0.82rem' }, `${label}: ${arr.map((l) => l.name).join(', ')}`) : null;

  const card = el('div', { class: 'card person-card' }, [
    el('div', { class: 'card-top' }, [
      el('a', { class: 'person-name', href: `#/u/${encodeURIComponent(p.username)}` }, [
        avatarFor(p.avatar, p.username, 32, p.avatar_image),
        el('strong', {}, `@${p.username}`),
      ]),
      store.user ? followBtn(p) : null,
    ]),
    langs('Speaks', p.native),
    langs('Learning', p.learning),
    p.bio ? el('p', { class: 'muted card-summary', style: 'margin-top:0.4rem' }, p.bio) : null,
    store.user ? el('a', { class: 'btn small secondary', href: `#/dm/${encodeURIComponent(p.username)}`, style: 'margin-top:0.5rem' }, 'Message') : null,
  ]);
  return card;
}

function followBtn(p) {
  const btn = el('button', { class: `btn small${p.following ? ' secondary' : ''}` }, p.following ? 'Following' : 'Follow');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const { following } = await api.followUser(p.username);
      p.following = following;
      btn.textContent = following ? 'Following' : 'Follow';
      btn.classList.toggle('secondary', following);
    } catch { /* ignore */ } finally { btn.disabled = false; }
  });
  return btn;
}
