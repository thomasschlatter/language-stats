// The "% of conversation" widget: buttons for 50 / 75 / 90 / 95% that show how
// many of the most frequent words (real OpenSubtitles data) make up that share
// of everyday speech — with the words themselves listed and clickable.

import { api } from '../api.js';
import { el, clear } from '../dom.js';
import { renderText } from '../render.js';

const LEVELS = [0.5, 0.75, 0.9, 0.95];

export function coverageWidget(langCode) {
  const wrap = el('div', { class: 'coverage' });
  const btnRow = el('div', { class: 'coverage-btns' });
  const result = el('div', { class: 'coverage-result' });
  const buttons = new Map();

  for (const t of LEVELS) {
    const b = el('button', { class: 'btn small secondary', onclick: () => select(t) }, `${Math.round(t * 100)}%`);
    buttons.set(t, b);
    btnRow.append(b);
  }

  wrap.append(
    el('div', { class: 'coverage-title' }, 'Words that cover this share of spoken German:'),
    btnRow,
    result
  );

  async function select(t) {
    for (const [lvl, b] of buttons) b.classList.toggle('active', lvl === t);
    clear(result).append(el('span', { class: 'muted' }, 'Loading…'));
    try {
      const data = await api.coverage(langCode, t);
      clear(result);
      result.append(
        el('p', { class: 'coverage-stat' }, [
          el('strong', {}, data.wordsNeeded.toLocaleString()),
          ` of the most frequent words make up ${Math.round(t * 100)}% of everyday conversation.`,
        ])
      );
      const cloud = el('p', { class: 'coverage-words', lang: langCode });
      cloud.append(renderText(data.words.map((w) => w.word).join('  ·  '), langCode));
      result.append(cloud);
      if (data.capped) {
        result.append(
          el('p', { class: 'muted', style: 'margin-top:0.5rem' },
            `Showing the first ${data.words.length.toLocaleString()} — ${(data.wordsNeeded - data.words.length).toLocaleString()} more not shown.`)
        );
      }
    } catch (ex) {
      clear(result).append(el('p', { class: 'error' }, ex.message));
    }
  }

  select(0.5); // default view
  return wrap;
}
