// Groups: create a group, invite people via a link, and chat inside it.
import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal as openModalFn } from '../dom.js';
import { renderText } from '../render.js';
import { avatarFor } from '../avatar.js';
import { signInPrompt } from '../auth.js';
import { navigate } from '../router.js';

let pollTimer = null;
const stopPoll = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };
window.addEventListener('hashchange', () => { if (!/^#\/groups?/.test(location.hash) && !/^#\/g\//.test(location.hash)) stopPoll(); });

// #/groups — list my groups + create + join
export async function renderGroups() {
  stopPoll();
  const view = clear(document.getElementById('view'));
  if (!store.user) { view.append(el('p', {}, signInPrompt('to create and join groups.'))); return; }

  view.append(el('div', { class: 'section-head' }, [
    el('h1', { style: 'margin:0' }, 'Groups'),
    el('button', { class: 'btn small', onclick: () => openCreate() }, '+ New group'),
  ]));
  view.append(el('p', { class: 'muted', style: 'margin-top:-0.5rem' }, 'Private group chats. Invite friends with a link; jump into a world together.'));

  const joinRow = el('form', {
    class: 'row', style: 'gap:0.5rem; margin:0.5rem 0 1rem',
    onsubmit: async (e) => {
      e.preventDefault();
      const code = codeInput.value.trim();
      if (!code) return;
      try { const { group } = await api.joinGroup(code); navigate(`#/groups/${group.id}`); }
      catch (ex) { joinErr.textContent = ex.message; }
    },
  }, []);
  const codeInput = el('input', { type: 'text', placeholder: 'paste an invite code', style: 'max-width:220px' });
  const joinErr = el('span', { class: 'error' });
  joinRow.append(codeInput, el('button', { class: 'btn small secondary', type: 'submit' }, 'Join'), joinErr);
  view.append(joinRow);

  const list = el('div', {});
  view.append(list);
  list.append(el('p', { class: 'muted' }, 'Loading…'));
  try {
    const { groups } = await api.groups();
    clear(list);
    if (!groups.length) { list.append(el('p', { class: 'muted' }, 'No groups yet. Create one!')); return; }
    for (const g of groups) {
      list.append(el('a', { class: 'card group-card', href: `#/groups/${g.id}` }, [
        el('strong', {}, g.name),
        el('div', { class: 'muted', style: 'font-size:0.82rem' }, `${g.members} member${g.members === 1 ? '' : 's'} · ${g.message_count} message${g.message_count === 1 ? '' : 's'}`),
      ]));
    }
  } catch (ex) { clear(list).append(el('p', { class: 'error' }, ex.message)); }

  function openCreate() {
    const input = el('input', { type: 'text', placeholder: 'group name', style: 'max-width:220px' });
    input.value = '';
    const err = el('div', { class: 'error' });
    const box = el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (!input.value.trim()) return;
        try { const { group } = await api.createGroup(input.value.trim()); close(); navigate(`#/groups/${group.id}`); }
        catch (ex) { err.textContent = ex.message; }
      },
    }, [el('h2', {}, 'New group'), input, err, el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Create')])]);
    const close = openModalFn(box);
  }
}

// #/g/:code — landing for an invite link: join then go to the group
export async function renderGroupInvite(code) {
  const view = clear(document.getElementById('view'));
  if (!store.user) { view.append(el('p', {}, signInPrompt('to join this group.'))); return; }
  view.append(el('p', { class: 'muted' }, 'Joining group…'));
  try { const { group } = await api.joinGroup(code); navigate(`#/groups/${group.id}`); }
  catch (ex) { clear(view).append(el('p', { class: 'error' }, ex.message), el('a', { href: '#/groups', class: 'btn small' }, 'My groups')); }
}

// #/groups/:id — one group: members, invite link, chat
export async function renderGroup(id) {
  stopPoll();
  const view = clear(document.getElementById('view'));
  if (!store.user) { view.append(el('p', {}, signInPrompt('to open this group.'))); return; }
  view.append(el('a', { href: '#/groups', class: 'muted' }, '← Groups'));

  let group;
  try { ({ group } = await api.group(id)); }
  catch (ex) { view.append(el('p', { class: 'error' }, ex.message)); return; }

  view.append(el('h1', { style: 'margin:0.3rem 0 0.2rem' }, group.name));
  view.append(el('div', { class: 'muted', style: 'font-size:0.85rem' },
    (group.memberList || []).map((m) => `@${m.username}`).join(', ')));

  // Invite link
  const inviteUrl = `${location.origin}/#/g/${group.invite_code}`;
  const copyBtn = el('button', { class: 'btn small secondary' }, '🔗 Copy invite link');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(inviteUrl); copyBtn.textContent = '✓ Copied'; setTimeout(() => { copyBtn.textContent = '🔗 Copy invite link'; }, 1500); }
    catch { copyBtn.textContent = inviteUrl; }
  });
  view.append(el('div', { class: 'row', style: 'gap:0.5rem; margin:0.7rem 0 1rem' }, [copyBtn]));

  // Chat
  const listEl = el('div', { class: 'chat-list' });
  view.append(listEl);
  let lastId = 0;
  const bodyLangOf = (m) => m.body_lang || store.nativeLang;
  const renderMsg = (m) => el('div', { class: 'chat-msg' }, [
    el('a', { class: 'chat-avatar-link', href: `#/u/${encodeURIComponent(m.author)}` }, avatarFor(m.author_avatar, m.author, 32, m.author_avatar_image)),
    el('div', { class: 'chat-msg-main' }, [
      el('div', { class: 'chat-meta' }, [el('span', { class: 'chat-author' }, `@${m.author}`), el('span', { class: 'chat-lang' }, bodyLangOf(m))]),
      el('div', { class: 'chat-body', lang: bodyLangOf(m) }, renderText(m.body, bodyLangOf(m))),
    ]),
  ]);
  const atBottom = () => listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;
  const add = (m) => { if (m.id > lastId) { listEl.append(renderMsg(m)); lastId = m.id; } };

  try { const { messages } = await api.groupMessages(id); messages.forEach(add); listEl.scrollTop = listEl.scrollHeight; }
  catch { /* ignore */ }

  const input = el('input', { type: 'text', placeholder: 'Message the group…', autocomplete: 'off' });
  const writtenIn = el('select', { class: 'chat-lang-select', title: 'Language you are writing in' },
    store.languages.map((l) => el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.code)));
  view.append(el('form', {
    class: 'chat-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      try { const { message } = await api.sendGroupMessage(id, { body: text, bodyLanguageCode: writtenIn.value }); add(message); listEl.scrollTop = listEl.scrollHeight; }
      catch { input.value = text; }
    },
  }, [input, writtenIn, el('button', { class: 'btn', type: 'submit' }, 'Send')]));

  pollTimer = setInterval(async () => {
    try { const { messages } = await api.groupMessages(id, lastId); if (!messages.length) return; const stick = atBottom(); messages.forEach(add); if (stick) listEl.scrollTop = listEl.scrollHeight; }
    catch { /* ignore */ }
  }, 4000);
}
