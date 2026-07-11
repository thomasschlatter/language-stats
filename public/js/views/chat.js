// Per-language chat. Each message is prose in a locale, rendered with the
// shared word tokenizer — so every word anyone writes is clickable and
// translates to the reader's native locale. New messages arrive by polling.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { renderText } from '../render.js';
import { languageTabs } from './tabs.js';
import { signInPrompt } from '../auth.js';

let pollTimer = null;
function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// Stop polling as soon as we navigate away from a chat route.
window.addEventListener('hashchange', () => {
  if (!/^#\/lang\/[^/]+\/chat$/.test(location.hash)) stopPoll();
});

export async function renderChat(langCode) {
  stopPoll();
  const view = clear(document.getElementById('view'));
  const language = store.languages.find((l) => l.code === langCode);
  if (!language) {
    view.append(el('p', { class: 'muted' }, 'Unknown language.'));
    return;
  }

  view.append(languageTabs(langCode, 'chat'));
  view.append(el('h1', {}, `${language.name} chat`));
  view.append(
    el('p', { class: 'muted', style: 'margin-top:-0.5rem' },
      'Every word anyone writes is clickable — click it for its translation in your native locale.')
  );

  const list = el('div', { class: 'chat-list' });
  view.append(list);

  let lastId = 0;
  let emptyNote = null;

  const renderMsg = (m) => {
    const bodyLang = m.body_lang || store.nativeLang;
    return el('div', { class: 'chat-msg' }, [
      el('div', { class: 'chat-meta' }, [
        el('span', { class: 'chat-author' }, `@${m.author}`),
        el('span', { class: 'chat-lang' }, bodyLang),
      ]),
      el('div', { class: 'chat-body', lang: bodyLang }, renderText(m.body, bodyLang)),
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
      emptyNote = el('p', { class: 'muted' }, 'No messages yet. Say hello!');
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
