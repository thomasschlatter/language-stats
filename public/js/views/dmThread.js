// DM thread (#/dm/:username): the language-exchange core. Messages render with
// clickable words; each partner message can be TRANSLATED (word-gloss into your
// native locale) and CORRECTED (propose a fixed version, shown beneath).

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear } from '../dom.js';
import { renderText } from '../render.js';
import { signInPrompt } from '../auth.js';
import { avatarFor } from '../avatar.js';

let pollTimer = null;
function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
window.addEventListener('hashchange', () => {
  if (!/^#\/dm\//.test(location.hash)) stopPoll();
});

export async function renderDmThread(username) {
  stopPoll();
  const view = clear(document.getElementById('view'));

  if (!store.user) {
    view.append(el('p', {}, signInPrompt('to send messages.')));
    return;
  }

  view.append(
    el('div', { class: 'dm-head' }, [
      el('a', { href: '#/messages', class: 'muted' }, '← Messages'),
      el('h1', { style: 'margin:0.25rem 0' }, [
        'Chat with ',
        el('a', { href: `#/u/${encodeURIComponent(username)}` }, `@${username}`),
      ]),
    ])
  );

  const list = el('div', { class: 'chat-list' });
  view.append(list);

  let lastId = 0;
  let empty = null;

  const add = (m) => {
    if (empty?.parentNode) { empty.remove(); empty = null; }
    if (m.id > lastId) { list.append(messageEl(m)); lastId = m.id; }
  };
  const atBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 60;

  list.append(el('span', { class: 'muted' }, 'Loading…'));
  try {
    const { messages } = await api.dmThread(username);
    clear(list);
    if (!messages.length) { empty = el('p', { class: 'muted' }, 'No messages yet. Say hi!'); list.append(empty); }
    messages.forEach(add);
    list.scrollTop = list.scrollHeight;
  } catch (ex) {
    clear(list).append(el('p', { class: 'error' }, ex.message));
    return;
  }

  // Composer
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
        const { message } = await api.sendDM(username, { body: text, bodyLanguageCode: writtenIn.value });
        add(message);
        list.scrollTop = list.scrollHeight;
      } catch { input.value = text; }
    },
  }, [input, writtenIn, el('button', { class: 'btn', type: 'submit' }, 'Send')]);
  view.append(form);

  pollTimer = setInterval(async () => {
    try {
      const { messages } = await api.dmThread(username, lastId);
      if (!messages.length) return;
      const stick = atBottom();
      messages.forEach(add);
      if (stick) list.scrollTop = list.scrollHeight;
    } catch { /* ignore */ }
  }, 4000);
}

function messageEl(m) {
  const mine = m.sender === store.user.username;
  const bodyLang = m.body_lang || store.nativeLang;
  const row = el('div', { class: `chat-msg${mine ? ' mine' : ''}` });
  const wrap = el('div', { class: 'chat-msg-main' });

  row.append(
    el('a', { class: 'chat-avatar-link', href: `#/u/${encodeURIComponent(m.sender)}` }, avatarFor(m.sender_avatar, m.sender, 32)),
    wrap
  );

  wrap.append(
    el('div', { class: 'chat-meta' }, [
      el('span', { class: 'chat-author' }, `@${m.sender}`),
      el('span', { class: 'chat-lang' }, bodyLang),
    ])
  );
  const bubble = el('div', { class: 'chat-body', lang: bodyLang }, renderText(m.body, bodyLang));
  wrap.append(bubble);

  // Corrections shown beneath.
  const corr = el('div', { class: 'corrections' });
  (m.corrections || []).forEach((c) => corr.append(correctionEl(c, bodyLang)));
  wrap.append(corr);

  // Actions on the OTHER person's messages: translate + correct.
  if (!mine) {
    const actions = el('div', { class: 'msg-actions' });
    const glossLine = el('div', { class: 'gloss' });

    const translate = el('button', { class: 'btn link small' }, 'Translate');
    translate.addEventListener('click', async () => {
      if (glossLine.childNodes.length) { clear(glossLine); return; } // toggle off
      clear(glossLine).append(el('span', { class: 'muted' }, 'Translating… (first use loads the model, ~1 min)'));
      // Try the local AI model first (fluent sentence); fall back to word-gloss.
      try {
        const { translation } = await api.aiTranslate(m.body, bodyLang, store.nativeLang);
        clear(glossLine).append(
          el('div', { class: 'ai-translation' }, [
            el('span', { class: 'ai-badge' }, 'AI'),
            el('span', {}, translation),
          ])
        );
      } catch {
        try {
          const { tokens, known } = await api.translate(m.body, bodyLang, store.nativeLang);
          clear(glossLine);
          if (!known) { glossLine.append(el('span', { class: 'muted' }, `No translation available into ${store.nativeLang} yet.`)); return; }
          glossLine.append(el('span', { class: 'muted', style: 'margin-right:0.4rem' }, 'gloss:'));
          for (const t of tokens) {
            if (t.translation) glossLine.append(el('span', { class: 'gloss-pair' }, [el('span', { class: 'gloss-src' }, t.word), '→', el('span', { class: 'gloss-tr' }, t.translation)]));
          }
        } catch (ex) { clear(glossLine).append(el('span', { class: 'error' }, ex.message)); }
      }
    });

    const correct = el('button', { class: 'btn link small' }, 'Correct');
    correct.addEventListener('click', () => openCorrect(m, corr, bodyLang, correct));

    actions.append(translate, correct);
    wrap.append(actions, glossLine);
  }
  return row;
}

function correctionEl(c, bodyLang) {
  return el('div', { class: 'correction' }, [
    el('span', { class: 'correction-mark' }, '✎'),
    el('span', { class: 'correction-text', lang: bodyLang }, renderText(c.corrected_text, bodyLang)),
    c.note ? el('div', { class: 'correction-note muted' }, renderText(c.note, store.nativeLang)) : null,
    el('div', { class: 'correction-by muted' }, `by @${c.corrector}`),
  ]);
}

// Inline correction form prefilled with the original message text.
function openCorrect(m, corrContainer, bodyLang, triggerBtn) {
  if (triggerBtn.dataset.open) return;
  triggerBtn.dataset.open = '1';

  const corrected = el('input', { type: 'text', value: m.body });
  const note = el('input', { type: 'text', placeholder: 'note (optional)' });
  const err = el('div', { class: 'error' });
  const box = el('form', {
    class: 'correct-form',
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        const { correction } = await api.correctMessage(m.id, { correctedText: corrected.value, note: note.value });
        corrContainer.append(correctionEl(correction, bodyLang));
        box.remove();
        delete triggerBtn.dataset.open;
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [
    el('div', { class: 'muted', style: 'font-size:0.78rem' }, 'Propose a corrected version:'),
    corrected, note, err,
    el('div', { class: 'row', style: 'margin-top:0.4rem' }, [
      el('button', { class: 'btn small', type: 'submit' }, 'Save correction'),
      el('button', { class: 'btn small secondary', type: 'button', onclick: () => { box.remove(); delete triggerBtn.dataset.open; } }, 'Cancel'),
    ]),
  ]);
  triggerBtn.parentNode.after(box);
}
