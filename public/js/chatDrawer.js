// Collapsible left-side chat drawer. Replaces the top-nav Chat item: a toggle
// button opens/closes a docked panel with the public per-language chat. Polls
// only while open; shows the last 50 messages (all are stored server-side).
import { api } from './api.js';
import { store } from './store.js';
import { el, clear } from './dom.js';
import { renderText } from './render.js';
import { avatarFor } from './avatar.js';

let pollTimer = null;
let lastId = 0;
let opened = false;
let langCode = null;

const stopPoll = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };

export function initChatDrawer() {
  const toggle = document.getElementById('chat-toggle');
  const drawer = document.getElementById('chat-drawer');
  if (!toggle || !drawer) return;

  const setOpen = (v) => {
    opened = v;
    drawer.classList.toggle('open', v);
    drawer.setAttribute('aria-hidden', v ? 'false' : 'true');
    toggle.classList.toggle('active', v);
    localStorage.setItem('gf_chat_open', v ? '1' : '0');
    if (v) mount(); else stopPoll();
  };

  toggle.addEventListener('click', () => setOpen(!opened));
  // Close the drawer if the user logs out.
  store.subscribe(() => { if (!store.user && opened) setOpen(false); });
  if (localStorage.getItem('gf_chat_open') === '1' && store.user) setOpen(true);

  async function mount() {
    if (!store.user) { clear(drawer).append(el('p', { class: 'muted', style: 'padding:1rem' }, 'Sign in to chat.')); return; }
    stopPoll();
    lastId = 0;
    langCode = localStorage.getItem('ls_chat_room')
      || (store.languages.some((l) => l.code === store.nativeLang) ? store.nativeLang : store.languages[0]?.code);
    const language = store.languages.find((l) => l.code === langCode);
    if (!language) { clear(drawer).append(el('p', { class: 'muted', style: 'padding:1rem' }, 'No chat rooms.')); return; }
    localStorage.setItem('ls_chat_room', langCode);

    const roomSel = el('select', { class: 'chat-room-select' },
      store.languages.map((l) => el('option', { value: l.code, selected: l.code === langCode ? '' : null }, l.name)));
    roomSel.addEventListener('change', () => { localStorage.setItem('ls_chat_room', roomSel.value); mount(); });

    const list = el('div', { class: 'chat-list drawer-chat-list' });
    const listWrap = el('div', { class: 'drawer-body' }, [list]);

    clear(drawer).append(
      el('div', { class: 'drawer-head' }, [
        el('strong', {}, 'Chat'),
        roomSel,
        el('button', { class: 'drawer-close', title: 'Close', onclick: () => setOpen(false) }, '×'),
      ]),
      listWrap,
    );

    const bodyLangOf = (m) => m.body_lang || store.nativeLang;
    const renderMsg = (m) => el('div', { class: 'chat-msg' }, [
      el('a', { class: 'chat-avatar-link', href: `#/u/${encodeURIComponent(m.author)}` }, avatarFor(m.author_avatar, m.author, 28, m.author_avatar_image)),
      el('div', { class: 'chat-msg-main' }, [
        el('div', { class: 'chat-meta' }, [el('span', { class: 'chat-author' }, `@${m.author}`), el('span', { class: 'chat-lang' }, bodyLangOf(m))]),
        el('div', { class: 'chat-body', lang: bodyLangOf(m) }, renderText(m.body, bodyLangOf(m))),
      ]),
    ]);
    const atBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    const add = (m) => { if (m.id > lastId) { list.append(renderMsg(m)); lastId = m.id; } };

    try {
      const { messages } = await api.messages(langCode);
      clear(list);
      if (!messages.length) list.append(el('p', { class: 'muted', style: 'padding:0.5rem' }, `No messages in the ${language.name} room yet.`));
      messages.forEach(add);
      list.scrollTop = list.scrollHeight;
    } catch (ex) { clear(list).append(el('p', { class: 'error' }, ex.message)); }

    const input = el('input', { type: 'text', placeholder: 'Message…', autocomplete: 'off' });
    const writtenIn = el('select', { class: 'chat-lang-select', title: 'Language you are writing in' },
      store.languages.map((l) => el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.code)));
    const form = el('form', {
      class: 'chat-form drawer-chat-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        try { const { message } = await api.sendMessage({ languageCode: langCode, bodyLanguageCode: writtenIn.value, body: text }); add(message); list.scrollTop = list.scrollHeight; }
        catch { input.value = text; }
      },
    }, [input, writtenIn, el('button', { class: 'btn small', type: 'submit' }, 'Send')]);
    drawer.append(form);

    pollTimer = setInterval(async () => {
      if (!opened) return;
      try { const { messages } = await api.messages(langCode, lastId); if (!messages.length) return; const stick = atBottom(); messages.forEach(add); if (stick) list.scrollTop = list.scrollHeight; }
      catch { /* ignore */ }
    }, 4000);
  }
}
