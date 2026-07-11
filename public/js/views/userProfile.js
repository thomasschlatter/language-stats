// User profile page (#/u/:username): shows native/learning languages, bio,
// interests. If it's your own profile, you can edit it. (Follow + Message
// buttons are added in Feature 2/3.)

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';

export async function renderUserProfile(username) {
  const view = clear(document.getElementById('view'));
  view.append(el('p', { class: 'muted' }, 'Loading…'));

  let prof;
  try {
    prof = (await api.userProfile(username)).profile;
  } catch (ex) {
    clear(view).append(el('p', { class: 'error' }, ex.message));
    return;
  }

  clear(view);
  const isMe = store.user && store.user.username === prof.username;

  const langRow = (label, langs) =>
    el('div', { class: 'prof-langs' }, [
      el('span', { class: 'prof-langs-label' }, label),
      langs.length
        ? el('span', {}, langs.map((l) => el('span', { class: 'lang-pill' }, l.name)))
        : el('span', { class: 'muted' }, '—'),
    ]);

  view.append(
    el('div', { class: 'profile' }, [
      el('div', { class: 'profile-head' }, [
        el('div', { class: 'avatar' }, prof.username.slice(0, 2).toUpperCase()),
        el('div', {}, [
          el('h1', { style: 'margin:0' }, `@${prof.username}`),
          el('div', { class: 'muted' }, `member since ${(prof.created_at || '').slice(0, 10)}`),
        ]),
        el('div', { class: 'spacer' }),
        isMe
          ? el('button', { class: 'btn small', onclick: () => openEdit(prof) }, 'Edit profile')
          : (store.user
              ? el('div', { class: 'row' }, [followBtn(prof), el('a', { class: 'btn small secondary', href: `#/dm/${encodeURIComponent(prof.username)}` }, 'Message')])
              : null),
      ]),
      el('div', { class: 'prof-counts muted' }, `${prof.followers ?? 0} followers · ${prof.following_count ?? 0} following`),
      langRow('Speaks', prof.native),
      langRow('Learning', prof.learning),
      el('div', { class: 'prof-bio' }, prof.bio || el('span', { class: 'muted' }, 'No bio yet.')),
      prof.interests.length
        ? el('div', { class: 'prof-interests' }, prof.interests.map((t) => el('span', { class: 'tag-chip' }, t)))
        : null,
    ])
  );
}

function followBtn(prof) {
  const btn = el('button', { class: `btn small${prof.following ? ' secondary' : ''}` }, prof.following ? 'Following' : 'Follow');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const { following } = await api.followUser(prof.username);
      prof.following = following;
      btn.textContent = following ? 'Following' : 'Follow';
      btn.classList.toggle('secondary', following);
    } catch { /* ignore */ } finally { btn.disabled = false; }
  });
  return btn;
}

function openEdit(prof) {
  const err = el('div', { class: 'error' });
  const bio = el('textarea', { placeholder: 'A short bio…' });
  bio.value = prof.bio || '';
  const interests = el('input', { type: 'text', placeholder: 'interests, comma separated' });
  interests.value = prof.interests.join(', ');

  // Multi-select language pickers (checkbox lists).
  const nativeCodes = new Set(prof.native.map((l) => l.code));
  const learnCodes = new Set(prof.learning.map((l) => l.code));
  const picker = (selected) =>
    el('div', { class: 'lang-picker' }, store.languages.map((l) => {
      const cb = el('input', { type: 'checkbox', value: l.code });
      if (selected.has(l.code)) cb.checked = true;
      return el('label', { class: 'lang-check' }, [cb, ` ${l.name}`]);
    }));
  const nativePick = picker(nativeCodes);
  const learnPick = picker(learnCodes);
  const checked = (node) => [...node.querySelectorAll('input:checked')].map((i) => i.value);

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        await api.updateProfile({
          bio: bio.value,
          interests: interests.value.split(',').map((s) => s.trim()).filter(Boolean),
          native: checked(nativePick),
          learning: checked(learnPick),
        });
        close();
        renderUserProfile(prof.username);
      } catch (ex) {
        err.textContent = ex.message;
      }
    },
  }, [
    el('label', {}, 'Bio'), bio,
    el('label', {}, 'Interests'), interests,
    el('label', {}, 'Speaks (native)'), nativePick,
    el('label', {}, 'Learning'), learnPick,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Save')]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, 'Edit profile'), form]));
}
