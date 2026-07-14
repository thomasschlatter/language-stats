// Single source of truth for the multi-select language picker used across
// signup, edit-profile, and settings. A scrollable list (.lang-picker-list)
// with a clearly-marked selected state. Returns { el, get } where get() yields
// the selected language codes.

import { el } from './dom.js';
import { store } from './store.js';
import { byImportance } from './langOrder.js';

export function languageMultiPicker(selectedCodes = []) {
  const sel = new Set(selectedCodes);
  const langs = [...store.languages].sort(byImportance);
  const list = el('div', { class: 'lang-picker-list' }, langs.map((l) => {
    const item = el('button', {
      type: 'button',
      class: 'lang-picker-item' + (sel.has(l.code) ? ' selected' : ''),
      onclick: () => {
        if (sel.has(l.code)) { sel.delete(l.code); item.classList.remove('selected'); }
        else { sel.add(l.code); item.classList.add('selected'); }
      },
    }, [el('span', {}, l.name), el('span', { class: 'check' }, '✓')]);
    return item;
  }));
  return { el: list, get: () => [...sel] };
}
