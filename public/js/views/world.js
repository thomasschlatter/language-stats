// The "World" — embeds the STRANDED (SkyOffice) multiplayer world, which runs
// as its own companion service. Language-stats passes the signed-in username so
// STRANDED can pre-fill it. The world URL is configurable (localStorage).

import { store } from '../store.js';
import { el, clear } from '../dom.js';

const DEFAULT_URL = 'http://localhost:5173';
const urlKey = 'ls_world_url';
const worldUrl = () => localStorage.getItem(urlKey) || DEFAULT_URL;

export function renderWorld() {
  const view = clear(document.getElementById('view'));

  const base = worldUrl();
  const src = store.user ? `${base}?name=${encodeURIComponent(store.user.username)}` : base;

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

  const frame = el('iframe', {
    class: 'world-frame',
    src,
    allow: 'camera; microphone; fullscreen; display-capture',
  });
  view.append(frame);

  const hint = el('p', { class: 'muted', style: 'font-size:0.8rem; margin-top:0.5rem' },
    `If nothing loads, start the world (in the repo's world/ folder): "npm run world:install" once, then "npm run world:server" (Colyseus :2567) and "npm run world:client" (Vite :5173). Expected at ${base}.`);
  view.append(hint);

  function changeUrl() {
    const next = window.prompt('World (STRANDED client) URL:', base);
    if (next && next.trim()) { localStorage.setItem(urlKey, next.trim()); renderWorld(); }
  }
}
