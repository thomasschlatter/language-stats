// The "World" — embeds the STRANDED (SkyOffice) multiplayer world, which runs
// as its own companion service. When you're signed in, language-stats hands off
// your username AND your character (avatar layer indices) so STRANDED uses it
// directly instead of making you recreate one. In production, its separately
// deployed URL is supplied by the main app server.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';

export async function renderWorld() {
  const view = clear(document.getElementById('view'));
  let base = null;
  try {
    ({ url: base } = await api.world());
  } catch {
    // Leave the World unavailable rather than embedding a broken frame.
  }

  if (!base) {
    view.append(
      el('div', { class: 'world-bar' }, [
        el('div', {}, [
          el('strong', {}, 'World'),
          el('span', { class: 'muted', style: 'margin-left:0.6rem; font-size:0.85rem' }, 'The shared World is currently unavailable.'),
        ]),
      ])
    );
    return;
  }

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

  // The game fills the whole area; a single "open in new tab" control floats on
  // top of it (no header bar).
  const frame = el('iframe', {
    class: 'world-frame',
    src,
    allow: 'camera; microphone; fullscreen; display-capture',
  });
  // Keep keyboard focus on the game so key releases reach it (a lost keyup makes
  // the character walk forever). Focus it once it loads and whenever the pointer
  // is over it.
  frame.addEventListener('load', () => frame.focus());
  frame.addEventListener('mouseenter', () => frame.focus());

  const wrap = el('div', { class: 'world-wrap' });
  const fsBtn = el('button', { class: 'world-open-btn', title: 'Toggle fullscreen' }, '⛶ Fullscreen');
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      (wrap.requestFullscreen || frame.requestFullscreen || (() => {})).call(
        wrap.requestFullscreen ? wrap : frame
      );
    }
  });
  document.addEventListener('fullscreenchange', () => {
    fsBtn.textContent = document.fullscreenElement ? '⛶ Exit fullscreen' : '⛶ Fullscreen';
  });

  wrap.append(frame, fsBtn);
  view.append(wrap);

  // Size the game to exactly the space below the top bar (measure it, don't
  // assume a fixed 57px) — so the game never runs off the bottom of the page.
  const sizeWrap = () => {
    if (document.fullscreenElement) { wrap.style.height = ''; return; }
    const header = document.querySelector('.topbar');
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 57;
    wrap.style.height = `${window.innerHeight - h}px`;
  };
  sizeWrap();
  window.addEventListener('resize', sizeWrap);
  document.addEventListener('fullscreenchange', sizeWrap);
}
