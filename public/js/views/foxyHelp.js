// "Chat with Foxy" — a help assistant grounded on public app facts (local model).
import { api } from '../api.js';
import { el, clear } from '../dom.js';

export function renderFoxyHelp() {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, '🦊 Ask Foxy'));
  view.append(el('p', { class: 'muted', style: 'margin-top:-0.5rem' },
    'Foxy can answer questions about Groupifier — decks, tips, groups, the World, and more.'));

  const listEl = el('div', { class: 'chat-list foxy-help-list' });
  view.append(listEl);

  const addMsg = (who, node) => {
    listEl.append(el('div', { class: `foxy-msg foxy-${who}` }, [
      el('span', { class: 'foxy-who' }, who === 'foxy' ? '🦊 Foxy' : 'You'),
      el('div', { class: 'foxy-body' }, node),
    ]));
    listEl.scrollTop = listEl.scrollHeight;
  };

  addMsg('foxy', 'Yip! Ask me anything about how Groupifier works.');

  const input = el('input', { type: 'text', placeholder: 'e.g. how do shared decks work?', autocomplete: 'off' });
  const form = el('form', {
    class: 'chat-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      addMsg('you', q);
      const thinking = el('span', { class: 'muted' }, 'Foxy is thinking…');
      addMsg('foxy', thinking);
      try {
        const { answer, sources } = await api.askFoxy(q);
        const body = el('div', {}, [el('div', {}, answer)]);
        if (sources?.length) {
          body.append(el('div', { class: 'foxy-sources' },
            sources.map((s) => el('a', { class: 'foxy-source', href: s.link }, s.title))));
        }
        thinking.parentNode.replaceChildren(body);
      } catch (ex) {
        thinking.parentNode.replaceChildren(el('span', { class: 'error' }, ex.message));
      }
      listEl.scrollTop = listEl.scrollHeight;
    },
  }, [input, el('button', { class: 'btn', type: 'submit' }, 'Ask')]);
  view.append(form);
}
