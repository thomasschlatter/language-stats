// Settings: appearance (theme + native language), your character, profile,
// and account (change password / sign out).

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { avatarFor } from '../avatar.js';
import { signInPrompt } from '../auth.js';
import { openCharacterCreator } from './characterCreator.js';

function section(title, children) {
  return el('section', { class: 'settings-section' }, [
    el('h2', { class: 'settings-title' }, title),
    el('div', { class: 'settings-body' }, children),
  ]);
}
function field(label, control) {
  return el('div', { class: 'settings-field' }, [el('label', {}, label), control]);
}

export async function renderSettings() {
  const view = clear(document.getElementById('view'));
  view.append(el('h1', {}, 'Settings'));

  // --- Appearance (available to everyone) ---
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const setTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('ls_theme', t);
    renderSettings();
  };
  const themeBtn = (label, value) =>
    el('button', { class: `btn small${theme === value ? '' : ' secondary'}`, onclick: () => setTheme(value) }, label);

  const nativeSelect = el('select', {
    onchange: (e) => store.setNative(e.target.value),
  }, store.languages.map((l) => el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.name)));

  view.append(section('Appearance', [
    field('Theme', el('div', { class: 'row' }, [themeBtn('☀️ Light', 'light'), themeBtn('🌙 Dark', 'dark')])),
    field('Native language (words translate into this)', nativeSelect),
  ]));

  // Word familiarity: explains the red→green colouring and the active "seen" policy.
  const familiaritySection = section('Word familiarity', [
    el('p', { class: 'muted', style: 'margin-top:0' },
      'Words are highlighted red→green. The 👁 Seen / 🎴 Studied toggle (top bar) picks what the colour means: how often you\'ve seen a word, or its spaced-repetition study progress. Words in a study deck also get an underline.'),
    el('div', { class: 'seen-legend' }, [
      el('span', {}, 'red = new'),
      el('div', { class: 'seen-gradient' }),
      el('span', {}, 'green = familiar'),
    ]),
    el('div', { class: 'muted', style: 'font-size:0.82rem; margin-top:0.6rem' }, el('span', { id: 'seen-policy' }, 'Loading policy…')),
  ]);
  view.append(familiaritySection);
  api.seenPolicy().then(({ current, policies }) => {
    const p = policies[current];
    const node = document.getElementById('seen-policy');
    if (node && p) node.textContent = `"Seen" policy: ${current} — ${p.description}`;
  }).catch(() => {});

  if (!store.user) {
    view.append(el('p', {}, signInPrompt('to edit your character, profile and account.')));
    return;
  }

  // --- The rest needs the signed-in user's profile ---
  let prof;
  try {
    prof = (await api.myProfile()).profile;
  } catch (ex) {
    view.append(el('p', { class: 'error' }, ex.message));
    return;
  }

  // Character
  view.append(section('Your character', [
    el('div', { class: 'row', style: 'gap:1rem; align-items:center' }, [
      avatarFor(prof.avatar, prof.username, 64),
      el('button', { class: 'btn small', onclick: () => openCharacterCreator(prof.avatar, () => renderSettings()) },
        prof.avatar ? 'Edit character' : 'Create character'),
    ]),
  ]));

  // Profile (bio, origin, location, interests, languages)
  view.append(section('Profile', [profileForm(prof)]));

  // Account
  view.append(section('Account', [
    changePasswordForm(),
    el('div', { class: 'row', style: 'margin-top:1rem; gap:0.5rem' }, [
      el('button', { class: 'btn small secondary', onclick: async () => { await api.logout(); store.set({ user: null }); renderSettings(); } }, 'Sign out'),
      el('button', { class: 'btn small danger', onclick: confirmDeleteAccount }, 'Delete account'),
    ]),
  ]));
}

function profileForm(prof) {
  const err = el('div', { class: 'error' });
  const ok = el('div', { class: 'ok-msg' });
  const bio = el('textarea', { placeholder: 'A short bio…' }); bio.value = prof.bio || '';
  const origin = el('input', { type: 'text', placeholder: 'e.g. Munich, Germany' }); origin.value = prof.origin || '';
  const location = el('input', { type: 'text', placeholder: 'e.g. London, UK' }); location.value = prof.location || '';
  const interests = el('input', { type: 'text', placeholder: 'interests, comma separated' }); interests.value = prof.interests.join(', ');

  const langChecks = (selected) => el('div', { class: 'lang-picker' }, store.languages.map((l) => {
    const cb = el('input', { type: 'checkbox', value: l.code });
    if (selected.has(l.code)) cb.checked = true;
    return el('label', { class: 'lang-check' }, [cb, ` ${l.name}`]);
  }));
  const nativePick = langChecks(new Set(prof.native.map((l) => l.code)));
  const learnPick = langChecks(new Set(prof.learning.map((l) => l.code)));
  const checked = (n) => [...n.querySelectorAll('input:checked')].map((i) => i.value);

  return el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = ''; ok.textContent = '';
      try {
        await api.updateProfile({
          bio: bio.value,
          origin: origin.value,
          location: location.value,
          interests: interests.value.split(',').map((s) => s.trim()).filter(Boolean),
          native: checked(nativePick),
          learning: checked(learnPick),
        });
        ok.textContent = 'Saved.';
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [
    field('Bio', bio),
    field('From (origin)', origin),
    field('Lives in', location),
    field('Interests', interests),
    field('Speaks (native)', nativePick),
    field('Learning', learnPick),
    err, ok,
    el('div', { style: 'margin-top:0.75rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Save profile')]),
  ]);
}

function confirmDeleteAccount() {
  const err = el('div', { class: 'error' });
  const close = openModal(el('div', {}, [
    el('h2', {}, 'Delete your account?'),
    el('p', { class: 'muted' }, 'This permanently removes your profile, character, decks, messages, and progress. This cannot be undone.'),
    err,
    el('div', { class: 'row', style: 'justify-content:flex-end; margin-top:1rem' }, [
      el('button', { class: 'btn small secondary', type: 'button', onclick: () => close() }, 'Cancel'),
      el('button', { class: 'btn small danger', type: 'button', onclick: async () => {
        try { await api.deleteAccount(); store.set({ user: null }); close(); location.hash = '#/'; }
        catch (ex) { err.textContent = ex.message; }
      } }, 'Delete forever'),
    ]),
  ]));
}

function changePasswordForm() {
  const err = el('div', { class: 'error' });
  const ok = el('div', { class: 'ok-msg' });
  const cur = el('input', { type: 'password', placeholder: 'current password' });
  const next = el('input', { type: 'password', placeholder: 'new password (min 6 chars)' });
  return el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = ''; ok.textContent = '';
      try {
        await api.changePassword({ currentPassword: cur.value, newPassword: next.value });
        cur.value = ''; next.value = '';
        ok.textContent = 'Password changed.';
      } catch (ex) { err.textContent = ex.message; }
    },
  }, [
    field('Current password', cur),
    field('New password', next),
    err, ok,
    el('div', { style: 'margin-top:0.5rem' }, [el('button', { class: 'btn small', type: 'submit' }, 'Change password')]),
  ]);
}
