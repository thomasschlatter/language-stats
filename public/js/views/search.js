// Word search: dictionary matches across languages, plus "open as a word" in
// any language (which on-demand fetches a definition if it's new).

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';

export async function renderSearch(q) {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, `Search: “${q}”`));

  // Open the exact term as a word page in any language.
  view.append(el('div', { class: 'links-title' }, 'Open as a word'));
  view.append(
    el('div', { class: 'row', style: 'flex-wrap:wrap; gap:0.4rem; margin-top:0.4rem' },
      store.languages.map((l) =>
        el('a', { class: 'btn small secondary', href: `#/w/${encodeURIComponent(l.code)}/${encodeURIComponent(q)}` }, l.name)))
  );

  // Existing dictionary entries that match.
  view.append(el('div', { class: 'links-title', style: 'margin-top:1.75rem' }, 'In the dictionary'));
  const list = el('div', { class: 'card-grid', style: 'margin-top:0.5rem' });
  view.append(list);
  list.append(el('p', { class: 'muted' }, 'Searching…'));

  try {
    const { results } = await api.searchWords(q);
    clear(list);
    if (!results.length) {
      list.append(el('p', { class: 'muted' }, 'No dictionary entries yet — use “Open as a word” above to look it up.'));
      return;
    }
    for (const r of results) {
      list.append(
        el('a', { class: 'card search-result', href: `#/w/${encodeURIComponent(r.language_code)}/${encodeURIComponent(r.text)}` }, [
          el('div', { class: 'row', style: 'gap:0.5rem; align-items:baseline' }, [
            el('strong', {}, r.text),
            el('span', { class: 'lang-mini' }, r.language_code),
          ]),
          r.def ? el('div', { class: 'muted card-summary', style: 'margin-top:0.2rem' }, r.def.slice(0, 120)) : null,
        ])
      );
    }
  } catch (ex) {
    clear(list).append(el('p', { class: 'error' }, ex.message));
  }
}
