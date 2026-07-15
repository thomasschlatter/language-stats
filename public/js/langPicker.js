// Single source of truth for the multi-select language picker used across
// signup, edit-profile, and settings. A scrollable list (.lang-picker-list)
// with a clearly-marked selected state. Returns { el, get } where get() yields
// the selected language codes.

import { el, clear } from './dom.js';
import { store } from './store.js';
import { byImportance } from './langOrder.js';
import { api } from './api.js';

// Native-language manager: multiple natives shown as pills, one marked primary
// (★) — the primary drives click-to-translate. Persists immediately to the
// server and calls reRender() to refresh. Shared by the profile and settings
// pages so they stay in sync.
export function nativeLanguagesSetting(prof, reRender) {
  const natives = prof.native || [];
  const primary = prof.primaryNative || (natives[0] && natives[0].code) || null;
  const available = store.languages
    .filter((l) => !natives.some((n) => n.code === l.code))
    .sort(byImportance);

  const save = async (patch) => {
    try { await api.updateProfile(patch); } catch { /* ignore */ }
    reRender();
  };

  const addNative = (code) => { if (code) save({ native: [...natives.map((n) => n.code), code] }); };
  const optionsFor = (langs) => [
    el('option', { value: '' }, '+ Add a native language…'),
    ...langs.map((l) => el('option', { value: l.code },
      l.tier && l.tier !== 'official' && l.tier !== 'regional' ? `${l.name} · ${l.tier}` : l.name)),
  ];
  const addSelect = el('select', {
    class: 'native-select',
    onchange: (e) => addNative(e.target.value),
  }, optionsFor(available));

  // Search the full 7,800+ catalogue so deep languages are reachable, not just
  // the surface set. Typing swaps the select's options for the matches.
  const searchBox = el('input', { type: 'search', class: 'native-search', placeholder: 'search all languages…' });
  let st;
  searchBox.addEventListener('input', () => {
    clearTimeout(st);
    st = setTimeout(async () => {
      const q = searchBox.value.trim();
      if (!q) { clear(addSelect).append(...optionsFor(available)); return; }
      try {
        const { languages } = await api.languages({ search: q });
        const opts = languages.filter((l) => !natives.some((n) => n.code === l.code));
        clear(addSelect).append(...optionsFor(opts));
      } catch { /* ignore */ }
    }, 250);
  });

  return el('div', { class: 'prof-setting' }, [
    el('span', { class: 'prof-langs-label' }, 'Native languages'),
    el('div', { class: 'muted', style: 'font-size:0.8rem; margin:0.15rem 0 0.45rem' }, 'Words translate into your ★ primary language.'),
    el('div', { class: 'learn-pills' },
      natives.length
        ? natives.map((l) => {
            const isPrimary = l.code === primary;
            return el('span', { class: 'lang-pill removable' + (isPrimary ? ' primary' : '') }, [
              el('button', {
                class: 'pin-primary', type: 'button',
                title: isPrimary ? 'Primary — translations use this' : 'Make primary',
                onclick: () => { if (!isPrimary) { store.setNative(l.code); save({ primaryNative: l.code }); } },
              }, isPrimary ? '★' : '☆'),
              ' ' + l.name,
              el('button', {
                class: 'lang-pill-x', type: 'button', title: `Remove ${l.name}`,
                onclick: () => save({ native: natives.filter((n) => n.code !== l.code).map((n) => n.code) }),
              }, '×'),
            ]);
          })
        : el('span', { class: 'muted' }, 'None yet — add one below.')
    ),
    el('div', { class: 'native-add-row' }, [searchBox, addSelect]),
  ]);
}

export function languageMultiPicker(selectedCodes = []) {
  const sel = new Set(selectedCodes);
  const extra = new Map(); // searched deep languages not in the surface set
  const list = el('div', { class: 'lang-picker-list' });

  const itemFor = (l) => {
    const item = el('button', {
      type: 'button',
      class: 'lang-picker-item' + (sel.has(l.code) ? ' selected' : ''),
      onclick: () => {
        if (sel.has(l.code)) { sel.delete(l.code); item.classList.remove('selected'); }
        else { sel.add(l.code); item.classList.add('selected'); }
      },
    }, [
      el('span', {}, l.tier && l.tier !== 'official' && l.tier !== 'regional' && l.tier !== null
        ? `${l.name} · ${l.tier}` : l.name),
      el('span', { class: 'check' }, '✓'),
    ]);
    return item;
  };

  const surface = () => {
    const base = [...store.languages];
    for (const l of extra.values()) if (!base.some((b) => b.code === l.code)) base.push(l);
    return base.sort(byImportance);
  };
  const render = (langs) => { clear(list); for (const l of (langs || surface())) list.append(itemFor(l)); };

  const search = el('input', { type: 'search', class: 'lang-picker-search', placeholder: 'search all 7,800+ languages…' });
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = search.value.trim();
      if (!q) { render(); return; }
      try {
        const { languages } = await api.languages({ search: q });
        for (const l of languages) extra.set(l.code, l);
        render(languages);
      } catch { /* ignore */ }
    }, 250);
  });

  render();
  return { el: el('div', {}, [search, list]), get: () => [...sel] };
}
