// Conversations list (#/messages): your DM threads, newest first.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { signInPrompt } from '../auth.js';
import { avatarFor } from '../avatar.js';

export async function renderMessages() {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, 'Messages'));

  if (!store.user) {
    view.append(el('p', {}, signInPrompt('to see your conversations.')));
    return;
  }

  const list = el('div', {});
  view.append(list);
  list.append(el('p', { class: 'muted' }, 'Loading…'));

  let conversations;
  try {
    ({ conversations } = await api.conversations());
    // Opening the inbox marked DMs read server-side — refresh the nav badge.
    window.dispatchEvent(new Event('ls:dm-changed'));
  } catch (ex) {
    clear(list).append(el('p', { class: 'error' }, ex.message));
    return;
  }
  clear(list);

  // Pinned: Ask Foxy (the help assistant), always available.
  list.append(el('a', { class: 'card convo', href: '#/dm/Foxy' }, [
    el('div', { class: 'convo-top' }, [
      el('span', { class: 'foxy-pin-avatar' }, '🦊'),
      el('strong', {}, 'Ask Foxy'),
    ]),
    el('div', { class: 'muted convo-preview' }, 'Questions about Groupifier? Ask me anything.'),
  ]));

  if (!conversations.length) {
    list.append(el('p', { class: 'muted' }, 'No other conversations yet — find someone in the Community and say hi.'));
    return;
  }
  for (const c of conversations) {
    const preview = c.last ? `${c.last.sender === store.user.username ? 'You: ' : ''}${c.last.body}` : '';
    list.append(
      el('a', { class: 'card convo', href: `#/dm/${encodeURIComponent(c.partner)}` }, [
        el('div', { class: 'convo-top' }, [
          avatarFor(c.partner_avatar, c.partner, 36, c.partner_avatar_image),
          el('strong', {}, `@${c.partner}`),
        ]),
        el('div', { class: 'muted convo-preview' }, preview),
      ])
    );
  }
}
