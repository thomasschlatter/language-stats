// The gender-stats widget: for a chosen coverage level, shows the POS breakdown
// of the words and — for the nouns — how well their ending predicts gender.

import { api } from '../api.js';
import { el, clear } from '../dom.js';

const LEVELS = [0.5, 0.75, 0.9, 0.95];
const GENDER = { m: { label: 'der', cls: 'g-m' }, f: { label: 'die', cls: 'g-f' }, n: { label: 'das', cls: 'g-n' } };

export function genderStatsWidget(langCode) {
  const wrap = el('div', { class: 'coverage gender-stats' });
  const btnRow = el('div', { class: 'coverage-btns' });
  const result = el('div', { class: 'coverage-result' });
  const buttons = new Map();

  for (const t of LEVELS) {
    const b = el('button', { class: 'btn small secondary', onclick: () => select(t) }, `${Math.round(t * 100)}%`);
    buttons.set(t, b);
    btnRow.append(b);
  }
  wrap.append(
    el('div', { class: 'coverage-title' }, 'Word types & noun-gender predictability at this coverage level:'),
    btnRow,
    result
  );

  async function select(t) {
    for (const [lvl, b] of buttons) b.classList.toggle('active', lvl === t);
    clear(result).append(el('span', { class: 'muted' }, 'Analysing…'));
    try {
      const d = await api.analysis(langCode, t);
      clear(result);
      result.append(posSection(d), nounSection(d.nouns));
    } catch (ex) {
      clear(result).append(el('p', { class: 'error' }, ex.message));
    }
  }

  select(0.9); // default to a level where nouns are plentiful
  return wrap;
}

function posSection(d) {
  const max = Math.max(...d.pos.map((p) => p.count), 1);
  const rows = d.pos.map((p) =>
    el('div', { class: 'bar-row' }, [
      el('span', { class: 'bar-label' }, p.label),
      el('span', { class: 'bar' }, el('span', { class: 'bar-fill', style: `width:${(p.count / max) * 100}%` })),
      el('span', { class: 'bar-val' }, p.count.toLocaleString()),
    ])
  );
  return el('div', { class: 'stats-block' }, [
    el('p', { class: 'coverage-stat' }, [
      `Of ${d.wordsNeeded.toLocaleString()} words, ${d.matched.toLocaleString()} are recognised `,
      el('span', { class: 'muted' }, `(${d.unknown.toLocaleString()} unknown)`),
      '. By type:',
    ]),
    el('div', { class: 'bars' }, rows),
  ]);
}

function nounSection(n) {
  const head = el('p', { class: 'coverage-stat', style: 'margin-top:1rem' }, [
    'Of ', el('strong', {}, n.total.toLocaleString()), ' nouns, ',
    el('strong', {}, `${n.withPredictiveEndingPct}%`), ' end in a gender-predictive suffix. ',
    'Guessing gender from the suffix is right ',
    el('strong', { class: 'g-acc' }, `${n.ruleAccuracyPct}%`), ' of the time.',
  ]);

  const table = el('table', { class: 'ending-table' }, [
    el('thead', {}, el('tr', {}, [
      el('th', {}, 'Ending'),
      el('th', {}, 'Nouns'),
      el('th', {}, 'Predicted'),
      el('th', {}, 'Exceptions'),
    ])),
    el('tbody', {},
      n.endings.slice(0, 14).map((e) => {
        const g = GENDER[e.predicted] || { label: e.predicted, cls: '' };
        return el('tr', {}, [
          el('td', { class: 'mono' }, e.ending),
          el('td', {}, e.count.toLocaleString()),
          el('td', {}, el('span', { class: `gtag ${g.cls}` }, g.label)),
          el('td', {}, [
            el('span', { class: 'exc-bar' }, el('span', { class: 'exc-fill', style: `width:${e.exceptionPct}%` })),
            el('span', { class: 'exc-val' }, `${e.exceptionPct}%`),
          ]),
        ]);
      })
    ),
  ]);

  return el('div', { class: 'stats-block' }, [head, table]);
}
