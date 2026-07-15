// A generated, rights-clean "title page" for a deck — our own artwork (colored
// panel + title + level), used when a deck has no licensed cover image. Gives
// every deck a finished book-cover look without borrowing anyone's artwork.
import { el } from './dom.js';

function hueFromString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

// Strip the "· …" tail so the cover shows the short deck name.
function shortTitle(name) {
  return String(name || '').split('·')[0].trim() || String(name || '');
}

export function genCoverEl(deck, { large = false } = {}) {
  const hue = hueFromString(deck.name || deck.lang_name || 'deck');
  return el('div', { class: `gen-cover${large ? ' gen-cover-lg' : ''}`, style: `--h:${hue}` }, [
    deck.level ? el('span', { class: 'gen-cover-level' }, deck.level.toUpperCase()) : null,
    el('span', { class: 'gen-cover-title' }, shortTitle(deck.name)),
    el('span', { class: 'gen-cover-foot' }, deck.lang_name || ''),
  ]);
}
