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

  // Filters list only the user's OWN languages (+ an "All" catch-all), so finding
  // partners for what you speak / are learning is one click away. The user's
  // languages live in their profile, not store.user.
  const codeName = new Map(store.languages.map((l) => [l.code, l.name]));
  let myLearning = [];
  let myNative = [];
  if (store.user) {
    try {
      const { profile } = await api.myProfile();
      myLearning = (profile.learning || []).map((l) => l.code || l);
      myNative = (profile.native || []).map((l) => l.code || l);
    } catch { /* no profile — just show All */ }
  }
  // Fallbacks from local state if the profile had none.
  if (!myLearning.length) myLearning = Array.from(store.learning || []);
  if (!myNative.length && store.nativeLang) myNative = [store.nativeLang];

  // Both filters offer just "All" + the user's own languages (native + learning).
  const myLangs = [...new Set([...myNative, ...myLearning])].filter((c) => codeName.has(c));
  const langSelect = () =>
    el('select', {}, [
      el('option', { value: '' }, 'All'),
      ...myLangs.map((c) => el('option', { value: c }, codeName.get(c))),
    ]);
  const speaks = langSelect();
  const learning = langSelect();
  const q = el('input', { type: 'search', placeholder: 'search @username', style: 'max-width:200px' });

  const lbl = (text, node) =>
    el('label', { class: 'muted', style: 'display:flex;align-items:center;gap:0.3rem;font-size:0.85rem' }, [text, node]);
  const controls = el('div', { class: 'row', style: 'margin:1rem 0; gap:0.7rem; flex-wrap:wrap' }, [
    lbl('Speaks', speaks), lbl('Learning', learning), q,
  ]);
  // Live search: filter as you type (debounced) and when a dropdown changes.
  let searchTimer;
  q.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => load(), 250); });
  speaks.addEventListener('change', () => load());
  learning.addEventListener('change', () => load());
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
        avatarFor(p.avatar, p.username, 56, p.avatar_image),
        el('strong', {}, `@${p.username}`),
      ]),
      store.user ? followBtn(p) : null,
    ]),
    langs('Speaks', p.native),
    langs('Learning', p.learning),
    p.bio ? el('p', { class: 'muted card-summary', style: 'margin-top:0.4rem' }, p.bio) : null,
    store.user ? el('a', { class: 'btn small secondary icon-btn', href: `#/dm/${encodeURIComponent(p.username)}`, title: `Message @${p.username}`, style: 'margin-top:0.5rem' }, '💬') : null,
  ]);
  return card;
}

function followBtn(p) {
  const btn = el('button', {
    class: `btn small icon-btn${p.following ? ' secondary' : ''}`,
    title: p.following ? 'Following — click to unfollow' : 'Follow',
  }, p.following ? '✓' : '+');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const { following } = await api.followUser(p.username);
      p.following = following;
      btn.textContent = following ? '✓' : '+';
      btn.title = following ? 'Following — click to unfollow' : 'Follow';
      btn.classList.toggle('secondary', following);
    } catch { /* ignore */ } finally { btn.disabled = false; }
  });
  return btn;
}
