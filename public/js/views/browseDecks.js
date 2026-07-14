// Browse shared flashcard decks — official + community-published, all upvotable.
// Add any to your own collection (copies the cards with fresh SRS state).
import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { navigate } from '../router.js';

const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

export async function renderBrowseDecks() {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, 'Shared decks'));
  view.append(el('p', { class: 'muted', style: 'margin-top:-0.5rem' },
    'Official and community decks. Upvote the good ones and add them to your collection.'));

  const learning = store.languages.filter((l) => store.isLearning(l.code) && l.code !== store.nativeLang);
  const langSel = el('select', {}, [
    el('option', { value: '' }, 'All languages'),
    ...(learning.length ? learning : store.languages).map((l) => el('option', { value: l.code }, l.name)),
  ]);
  const levelSel = el('select', {}, [
    el('option', { value: '' }, 'All levels'),
    ...LEVELS.map((lv) => el('option', { value: lv }, lv.toUpperCase())),
  ]);
  const q = el('input', { type: 'search', placeholder: 'search decks', style: 'max-width:180px' });

  // Type filter: which kind of deck. Exam = official exam boards (Goethe, DELF…).
  const KINDS = [
    ['', 'All'], ['official', 'Official'], ['textbook', 'Textbook'], ['exam', 'Exam boards'], ['community', 'Community'],
  ];
  let kind = '';
  const seg = el('div', { class: 'seg' });
  const segBtns = KINDS.map(([val, label]) => {
    const b = el('button', { class: `seg-btn${val === kind ? ' active' : ''}`, type: 'button' }, label);
    b.addEventListener('click', () => {
      if (kind === val) return;
      kind = val;
      segBtns.forEach((x, i) => x.classList.toggle('active', KINDS[i][0] === kind));
      load();
    });
    return b;
  });
  seg.append(...segBtns);

  view.append(el('div', { class: 'row', style: 'margin:1rem 0 0.6rem; gap:0.6rem; flex-wrap:wrap' }, [
    el('a', { class: 'btn small secondary', href: '#/decks' }, '← My decks'),
    langSel, levelSel, q,
  ]));
  view.append(el('div', { class: 'row', style: 'margin:0 0 1rem' }, [seg]));

  const grid = el('div', { class: 'card-grid' });
  view.append(grid);

  async function load() {
    clear(grid).append(el('span', { class: 'muted' }, 'Loading…'));
    try {
      const { decks } = await api.browseDecks({ lang: langSel.value, level: levelSel.value, q: q.value, kind });
      clear(grid);
      if (!decks.length) {
        const msg = kind === 'exam' ? 'No exam-board decks yet (Goethe, DELF, DELE… coming soon).'
          : kind === 'textbook' ? 'No textbook decks for this filter yet.'
            : kind === 'community' ? 'No community decks yet. Share one from your decks!'
              : 'No shared decks yet.';
        grid.append(el('p', { class: 'muted' }, msg));
        return;
      }
      for (const d of decks) grid.append(deckCard(d));
    } catch (ex) { clear(grid).append(el('p', { class: 'error' }, ex.message)); }
  }
  langSel.addEventListener('change', load);
  levelSel.addEventListener('change', load);
  let t;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
  load();
}

function deckCard(d) {
  return el('div', { class: 'card person-card' }, [
    el('strong', {}, d.name),
    el('div', { class: 'muted', style: 'font-size:0.8rem; margin-top:0.2rem' }, [
      d.is_official ? el('span', { class: 'badge official' }, 'Official') : el('span', { class: 'badge user' }, `@${d.author || 'user'}`),
      ` · ${d.lang_name} · ${d.total} cards${d.level ? ' · ' + d.level.toUpperCase() : ''}`,
    ]),
    el('div', { class: 'person-actions' }, [
      voteBtn(d),
      store.user
        ? el('button', { class: 'btn small', onclick: (e) => addToMine(d, e.currentTarget) }, '+ Add to my decks')
        : null,
    ]),
  ]);
}

function voteBtn(d) {
  const btn = el('button', { class: `vote-btn${d.voted ? ' voted' : ''}`, title: 'Upvote' }, `▲ ${d.votes}`);
  btn.addEventListener('click', async () => {
    if (!store.user) { navigate('#/'); return; }
    btn.disabled = true;
    try {
      const { voted, votes } = await api.voteDeck(d.id);
      d.voted = voted; d.votes = votes;
      btn.textContent = `▲ ${votes}`;
      btn.classList.toggle('voted', voted);
    } catch { /* ignore */ } finally { btn.disabled = false; }
  });
  return btn;
}

async function addToMine(d, btn) {
  // Once added, the same button becomes a shortcut to My decks (the click
  // handler is attached once via el(), so we branch on the added flag here
  // rather than swapping handlers — which would double-fire and re-copy).
  if (btn.dataset.added) { navigate('#/decks'); return; }
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    await api.copyDeck(d.id);
    btn.dataset.added = '1';
    btn.textContent = '✓ Added — go to My decks';
    btn.disabled = false;
  } catch (ex) {
    btn.textContent = '+ Add to my decks';
    btn.disabled = false;
    alert(ex.message);
  }
}
