// Conversations list (#/messages): your DM threads, newest first.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';

export async function renderMessages() {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, 'Messages'));

  if (!store.user) {
    view.append(el('p', { class: 'muted' }, 'Sign in to see your conversations.'));
    return;
  }

  const list = el('div', {});
  view.append(list);
  list.append(el('p', { class: 'muted' }, 'Loading…'));

  let conversations;
  try {
    ({ conversations } = await api.conversations());
  } catch (ex) {
    clear(list).append(el('p', { class: 'error' }, ex.message));
    return;
  }
  clear(list);

  if (!conversations.length) {
    list.append(el('p', { class: 'muted' }, 'No conversations yet. Find someone in the Community and say hi.'));
    return;
  }
  for (const c of conversations) {
    const preview = c.last ? `${c.last.sender === store.user.username ? 'You: ' : ''}${c.last.body}` : '';
    list.append(
      el('a', { class: 'card convo', href: `#/dm/${encodeURIComponent(c.partner)}` }, [
        el('div', { class: 'convo-top' }, [
          el('span', { class: 'avatar sm' }, c.partner.slice(0, 2).toUpperCase()),
          el('strong', {}, `@${c.partner}`),
        ]),
        el('div', { class: 'muted convo-preview' }, preview),
      ])
    );
  }
}
