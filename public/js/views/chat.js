// Per-language chat. Each message is prose in a locale, rendered with the
// shared word tokenizer — so every word anyone writes is clickable and
// translates to the reader's native locale. New messages arrive by polling.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { renderText } from '../render.js';
import { signInPrompt } from '../auth.js';
import { avatarFor } from '../avatar.js';
import { openReport } from '../report.js';
import { navigate } from '../router.js';

let pollTimer = null;
function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// Stop polling as soon as we navigate away from any chat route.
window.addEventListener('hashchange', () => {
  if (!/^#\/chat/.test(location.hash)) stopPoll();
});

export async function renderChat(langCode) {
  stopPoll();
  const view = clear(document.getElementById('view'));

  // Top-level chat: pick a room (default = last used, else your native locale).
  if (!langCode) {
    langCode = localStorage.getItem('ls_chat_room') ||
      (store.languages.some((l) => l.code === store.nativeLang) ? store.nativeLang : store.languages[0]?.code);
  }
  const language = store.languages.find((l) => l.code === langCode);
  if (!language) {
    view.append(el('p', { class: 'muted' }, 'No chat rooms available.'));
    return;
  }
  localStorage.setItem('ls_chat_room', langCode);

  const roomSel = el('select', {
    class: 'chat-room-select',
    onchange: (e) => navigate(`#/chat/${encodeURIComponent(e.target.value)}`),
  }, store.languages.map((l) => el('option', { value: l.code, selected: l.code === langCode ? '' : null }, l.name)));

  view.append(
    el('div', { class: 'section-head' }, [
      el('h1', { style: 'margin:0' }, 'Chat'),
      el('div', { class: 'row' }, [el('span', { class: 'muted' }, 'Room:'), roomSel]),
    ])
  );
  view.append(
    el('p', { class: 'muted', style: 'margin-top:-0.5rem' }, [
      `Public room — everyone learning ${language.name} can read and reply here. Looking for a 1-on-1? `,
      el('a', { href: '#/community' }, 'find a partner in Community'),
      '.',
    ])
  );

  const list = el('div', { class: 'chat-list' });
  view.append(list);

  let lastId = 0;
  let emptyNote = null;

  const renderMsg = (m) => {
    const bodyLang = m.body_lang || store.nativeLang;
    return el('div', { class: 'chat-msg' }, [
      el('a', { class: 'chat-avatar-link', href: `#/u/${encodeURIComponent(m.author)}` }, avatarFor(m.author_avatar, m.author, 32, m.author_avatar_image)),
      el('div', { class: 'chat-msg-main' }, [
        el('div', { class: 'chat-meta' }, [
          el('span', { class: 'chat-author' }, `@${m.author}`),
          el('span', { class: 'chat-lang' }, bodyLang),
          (store.user && m.author !== store.user.username)
            ? el('button', { class: 'btn link small', style: 'font-size:0.72rem', onclick: () => openReport('message', m.id) }, 'report')
            : null,
        ]),
        el('div', { class: 'chat-body', lang: bodyLang }, renderText(m.body, bodyLang)),
      ]),
    ]);
  };
  const atBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  const add = (m) => {
    if (emptyNote?.parentNode) { emptyNote.remove(); emptyNote = null; }
    if (m.id > lastId) { list.append(renderMsg(m)); lastId = m.id; }
  };

  // Initial load
  list.append(el('span', { class: 'muted' }, 'Loading…'));
  try {
    const { messages } = await api.messages(langCode);
    clear(list);
    if (!messages.length) {
      emptyNote = el('div', { class: 'chat-empty' }, [
        el('div', { class: 'chat-empty-emoji' }, '💬'),
        el('p', {}, `No one has posted in the ${language.name} room yet.`),
        el('p', { class: 'muted' }, 'Post below to break the ice — anyone learning ' +
          `${language.name} will see it and can jump in. Or switch rooms with the selector above.`),
      ]);
      list.append(emptyNote);
    }
    messages.forEach(add);
    list.scrollTop = list.scrollHeight;
  } catch (ex) {
    clear(list).append(el('p', { class: 'error' }, ex.message));
  }

  // Composer
  if (store.user) {
    const input = el('input', { type: 'text', placeholder: 'Write a message…', autocomplete: 'off' });
    const writtenIn = el('select', { class: 'chat-lang-select', title: 'Language you are writing in' },
      store.languages.map((l) => el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.code))
    );
    const form = el('form', {
      class: 'chat-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        try {
          const { message } = await api.sendMessage({
            languageCode: langCode,
            bodyLanguageCode: writtenIn.value,
            body: text,
          });
          add(message);
          list.scrollTop = list.scrollHeight;
        } catch (ex) {
          input.value = text; // restore on failure
        }
      },
    }, [input, writtenIn, el('button', { class: 'btn', type: 'submit' }, 'Send')]);
    view.append(form);
  } else {
    view.append(el('p', {}, signInPrompt('to join the chat.')));
  }

  // Poll for new messages (only while on this chat view).
  pollTimer = setInterval(async () => {
    try {
      const { messages } = await api.messages(langCode, lastId);
      if (!messages.length) return;
      const stick = atBottom();
      messages.forEach(add);
      if (stick) list.scrollTop = list.scrollHeight;
    } catch {
      /* ignore transient poll errors */
    }
  }, 4000);
}
