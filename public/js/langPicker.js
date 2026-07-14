// Single source of truth for the multi-select language picker used across
// signup, edit-profile, and settings. A scrollable list (.lang-picker-list)
// with a clearly-marked selected state. Returns { el, get } where get() yields
// the selected language codes.

import { el } from './dom.js';
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
    el('select', {
      class: 'native-select',
      onchange: (e) => { if (e.target.value) save({ native: [...natives.map((n) => n.code), e.target.value] }); },
    }, [
      el('option', { value: '' }, '+ Add a native language…'),
      ...available.map((l) => el('option', { value: l.code }, l.name)),
    ]),
  ]);
}

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
