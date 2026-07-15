// Conversation practice: role-play a real situation in your target language with
// an LLM NPC. Every NPC line is clickable (tap a word to translate).
import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { renderText } from '../render.js';
import { signInPrompt } from '../auth.js';
import { toast } from '../toast.js';

export async function renderPractice() {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, '🎭 Conversation practice'));
  view.append(el('p', { class: 'muted', style: 'margin-top:-0.5rem' }, "Role-play a real situation in the language you're learning."));
  if (!store.user) { view.append(el('p', {}, signInPrompt('to practice conversations.'))); return; }

  const learning = store.languages.filter((l) => store.isLearning(l.code) && l.code !== store.nativeLang);
  const langs = learning.length ? learning : store.languages.filter((l) => l.code !== store.nativeLang);
  const langSel = el('select', {}, langs.map((l) => el('option', { value: l.code }, l.name)));
  view.append(el('div', { class: 'row', style: 'gap:0.5rem; margin:0.6rem 0 1rem' }, [el('span', { class: 'muted' }, 'Practice in:'), langSel]));

  const grid = el('div', { class: 'card-grid' });
  view.append(grid);
  grid.append(el('span', { class: 'muted' }, 'Loading…'));
  try {
    const { available, scenarios } = await api.scenarios();
    clear(grid);
    if (!available) { grid.append(el('p', { class: 'muted' }, 'AI conversation practice is not available right now.')); return; }
    for (const s of scenarios) {
      const card = el('button', { class: 'card scenario-card', type: 'button' }, [
        el('span', { class: 'scenario-emoji' }, s.emoji),
        el('strong', {}, s.title),
      ]);
      card.addEventListener('click', () => openScenario(s, langSel.value));
      grid.append(card);
    }
  } catch (ex) { clear(grid).append(el('p', { class: 'error' }, ex.message)); }
}

function openScenario(scenario, langCode) {
  const view = clear(document.getElementById('view'));
  view.append(el('a', { class: 'muted', href: '#/practice', style: 'display:inline-block; margin-bottom:0.5rem' }, '← Scenarios'));
  const langName = store.languages.find((l) => l.code === langCode)?.name || langCode;
  view.append(el('h1', { style: 'margin:0.2rem 0 0' }, `${scenario.emoji} ${scenario.title}`));
  view.append(el('div', { class: 'muted', style: 'font-size:0.85rem; margin-bottom:0.5rem' }, `in ${langName} · tap any word to translate`));

  const listEl = el('div', { class: 'chat-list' });
  view.append(listEl);
  const history = [];
  const addMsg = (role, text) => {
    history.push({ role, content: text });
    listEl.append(el('div', { class: `scenario-msg scenario-${role}` },
      role === 'assistant' ? el('span', { lang: langCode }, renderText(text, langCode)) : text));
    listEl.scrollTop = listEl.scrollHeight;
  };

  const input = el('input', { type: 'text', placeholder: `Reply in ${langName}…`, autocomplete: 'off' });
  const send = el('button', { class: 'btn', type: 'submit' }, 'Send');
  view.append(el('form', {
    class: 'chat-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return;
      input.value = '';
      addMsg('user', t);
      await turn(t);
    },
  }, [input, send]));

  async function turn(message) {
    send.disabled = true;
    const thinking = el('div', { class: 'scenario-msg scenario-assistant muted' }, '…');
    listEl.append(thinking); listEl.scrollTop = listEl.scrollHeight;
    try {
      const { reply } = await api.scenarioTurn({
        scenarioId: scenario.id, langCode,
        history: message ? history.slice(0, -1) : history,
        message,
      });
      thinking.remove();
      addMsg('assistant', reply);
    } catch (ex) { thinking.remove(); toast(ex.message || 'The NPC is unavailable.', 'error'); }
    finally { send.disabled = false; }
  }

  turn(''); // NPC opens the scene
}
