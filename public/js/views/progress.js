// Progress dashboard: how many words you know, what share of everyday
// conversation they cover, and which frequent words to learn next.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { renderText, tokenizeTree } from '../render.js';
import { languageTabs } from './tabs.js';

const MILESTONES = [50, 75, 90, 95];

export async function renderProgress(langCode) {
  const view = clear(document.getElementById('view'));
  const language = store.languages.find((l) => l.code === langCode);
  if (!language) {
    view.append(el('p', { class: 'muted' }, 'Unknown language.'));
    return;
  }

  view.append(languageTabs(langCode, 'progress'));
  view.append(el('h1', {}, `Your ${language.name} progress`));

  if (!store.user) {
    view.append(el('p', { class: 'muted' }, 'Sign in to track words and see your conversation coverage.'));
    tokenizeTree(view);
    return;
  }

  const body = el('div', {});
  view.append(body);
  body.append(el('p', { class: 'muted' }, 'Loading…'));

  let data;
  try {
    data = await api.progress(langCode);
  } catch (ex) {
    clear(body).append(el('p', { class: 'error' }, ex.message));
    return;
  }
  clear(body);

  const { summary, suggestions } = data;

  // --- stat tiles ---
  body.append(
    el('div', { class: 'stat-tiles' }, [
      tile(summary.known, 'words known'),
      tile(summary.learning, 'learning'),
      tile(summary.coveragePct != null ? `${summary.coveragePct}%` : '—', 'of conversation'),
    ])
  );

  // --- coverage bar with milestones ---
  if (summary.hasFrequency) {
    const pct = summary.coveragePct || 0;
    const bar = el('div', { class: 'coverage-meter' }, [
      el('div', { class: 'coverage-meter-fill', style: `width:${Math.min(pct, 100)}%` }),
      ...MILESTONES.map((m) =>
        el('div', { class: `milestone${pct >= m ? ' reached' : ''}`, style: `left:${m}%` },
          el('span', { class: 'milestone-label' }, `${m}%`))
      ),
    ]);
    body.append(
      el('p', { class: 'muted', style: 'margin-top:1.25rem' },
        `Your known words cover ${pct}% of everyday spoken ${language.name}.`),
      bar
    );
  }

  // --- learn these next ---
  body.append(el('div', { class: 'links-title', style: 'margin-top:1.75rem' }, 'Learn these next (most frequent words you don’t know yet)'));
  if (!suggestions.length) {
    body.append(el('p', { class: 'muted' }, summary.hasFrequency ? 'You know all the top words. 🎉' : 'No frequency data for this language.'));
  } else {
    const cloud = el('p', { class: 'coverage-words', lang: langCode, style: 'margin-top:0.5rem' });
    cloud.append(renderText(suggestions.map((s) => s.word).join('  ·  '), langCode));
    body.append(cloud);
    body.append(el('p', { class: 'muted', style: 'font-size:0.8rem; margin-top:0.4rem' }, 'Click a word, then mark it “I know this”.'));
  }

  tokenizeTree(view);
}

function tile(value, label) {
  return el('div', { class: 'stat-tile' }, [
    el('div', { class: 'stat-value' }, String(value)),
    el('div', { class: 'stat-label' }, label),
  ]);
}
