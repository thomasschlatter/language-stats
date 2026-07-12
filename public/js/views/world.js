// The "World" — embeds the STRANDED (SkyOffice) multiplayer world, which runs
// as its own companion service. When you're signed in, language-stats hands off
// your username AND your character (avatar layer indices) so STRANDED uses it
// directly instead of making you recreate one. The world URL is configurable.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';

const DEFAULT_URL = 'http://localhost:5173';
const urlKey = 'ls_world_url';
const worldUrl = () => localStorage.getItem(urlKey) || DEFAULT_URL;

export async function renderWorld() {
  const view = clear(document.getElementById('view'));
  const base = worldUrl();

  // Build the handoff: name + character (if signed in and they made one).
  let query = '';
  if (store.user) {
    query = `?name=${encodeURIComponent(store.user.username)}`;
    try {
      const { profile } = await api.myProfile();
      if (profile.avatar) query += `&avatar=${encodeURIComponent(JSON.stringify(profile.avatar))}`;
    } catch { /* proceed with name only */ }
  }
  const src = `${base}${query}`;

  view.append(
    el('div', { class: 'world-bar' }, [
      el('div', {}, [
        el('strong', {}, 'World'),
        el('span', { class: 'muted', style: 'margin-left:0.6rem; font-size:0.85rem' }, 'A shared, walkable space (STRANDED). Move with arrow keys; meet others by video.'),
      ]),
      el('div', { class: 'row', style: 'gap:0.5rem' }, [
        el('a', { class: 'btn small secondary', href: src, target: '_blank', rel: 'noopener' }, 'Open in new tab'),
        el('button', { class: 'btn small secondary', onclick: () => changeUrl() }, 'Set world URL'),
      ]),
    ])
  );

  view.append(el('iframe', {
    class: 'world-frame',
    src,
    allow: 'camera; microphone; fullscreen; display-capture',
  }));

  view.append(el('p', { class: 'muted', style: 'font-size:0.8rem; margin-top:0.5rem' },
    `If nothing loads, start the world (in the repo's world/ folder): "npm run world:install" once, then "npm run world:server" (:2567) and "npm run world:client" (:5173). Expected at ${base}.`));

  function changeUrl() {
    const next = window.prompt('World (STRANDED client) URL:', base);
    if (next && next.trim()) { localStorage.setItem(urlKey, next.trim()); renderWorld(); }
  }
}
