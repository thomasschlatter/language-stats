// User profile page (#/u/:username): shows native/learning languages, bio,
// interests. If it's your own profile, you can edit it. (Follow + Message
// buttons are added in Feature 2/3.)

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { avatarFor } from '../avatar.js';
import { nativeSelector, logout } from '../auth.js';
import { openCharacterCreator } from './characterCreator.js';

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
        avatarFor(prof.avatar, prof.username, 64),
        el('div', {}, [
          el('h1', { style: 'margin:0' }, `@${prof.username}`),
          el('div', { class: 'muted' }, `member since ${(prof.created_at || '').slice(0, 10)}`),
        ]),
        el('div', { class: 'spacer' }),
        isMe
          ? el('div', { class: 'row' }, [
              el('button', { class: 'btn small', onclick: () => openCharacterCreator(prof.avatar, () => renderUserProfile(prof.username)) }, prof.avatar ? 'Edit character' : 'Create character'),
              el('button', { class: 'btn small secondary', onclick: () => openEdit(prof) }, 'Edit profile'),
              el('button', { class: 'btn small secondary', onclick: () => logout() }, 'Sign out'),
            ])
          : (store.user
              ? el('div', { class: 'row' }, [
                  prof.blocked ? null : followBtn(prof),
                  prof.blocked ? null : el('a', { class: 'btn small secondary', href: `#/dm/${encodeURIComponent(prof.username)}` }, 'Message'),
                  blockBtn(prof),
                ])
              : null),
      ]),
      el('div', { class: 'prof-counts muted' }, `${prof.followers ?? 0} followers · ${prof.following_count ?? 0} following`),
      langRow('Speaks', prof.native),
      langRow('Learning', prof.learning),
      (prof.origin || prof.location)
        ? el('div', { class: 'prof-place muted' }, [
            prof.origin ? `From ${prof.origin}` : null,
            prof.origin && prof.location ? ' · ' : null,
            prof.location ? `Lives in ${prof.location}` : null,
          ].filter(Boolean).join(''))
        : null,
      el('div', { class: 'prof-bio' }, prof.bio || el('span', { class: 'muted' }, 'No bio yet.')),
      prof.interests.length
        ? el('div', { class: 'prof-interests' }, prof.interests.map((t) => el('span', { class: 'tag-chip' }, titleCase(t))))
        : null,
    ])
  );

  // Your reading/translation settings live here now (was the top bar).
  if (isMe) {
    view.append(el('div', { class: 'prof-setting' }, nativeSelector()));
  }

  // Word-familiarity rundown (only on your own profile).
  if (isMe) {
    const box = el('div', { class: 'familiarity-rundown' }, [el('div', { class: 'links-title' }, 'Word familiarity'), el('p', { class: 'muted' }, 'Loading…')]);
    view.append(box);
    api.rundown().then(({ rundown }) => {
      clear(box).append(el('div', { class: 'links-title' }, 'Word familiarity'));
      if (!rundown.length) { box.append(el('p', { class: 'muted' }, 'Start reading and studying to build familiarity.')); return; }
      for (const r of rundown) {
        box.append(
          el('div', { class: 'fam-row' }, [
            el('div', { class: 'fam-lang' }, r.name),
            el('div', { class: 'fam-stats' }, [
              famStat(r.seen, 'seen'),
              famStat(r.inDeck, 'in decks'),
              famStat(r.mature, 'mastered'),
              famStat(r.known, 'marked known'),
              r.coveragePct != null ? famStat(`${r.coveragePct}%`, 'conversation') : null,
            ]),
          ])
        );
      }
    }).catch(() => { clear(box); });
  }
}

function famStat(value, label) {
  return el('div', { class: 'fam-stat' }, [
    el('div', { class: 'fam-value' }, String(value)),
    el('div', { class: 'fam-label' }, label),
  ]);
}

// Display helper: "board games" -> "Board Games" (doesn't mutate stored value).
function titleCase(s) {
  return String(s).replace(/\b\p{L}/gu, (c) => c.toUpperCase());
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

function blockBtn(prof) {
  const btn = el('button', { class: 'btn small secondary' }, prof.blocked ? 'Unblock' : 'Block');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const { blocked } = await api.blockUser(prof.username);
      prof.blocked = blocked;
      renderUserProfile(prof.username); // re-render to reflect follow/message availability
    } catch { btn.disabled = false; }
  });
  return btn;
}

function openEdit(prof) {
  const err = el('div', { class: 'error' });
  const bio = el('textarea', { placeholder: 'A short bio…' });
  bio.value = prof.bio || '';
  const origin = el('input', { type: 'text', placeholder: 'e.g. Munich, Germany' });
  origin.value = prof.origin || '';
  const location = el('input', { type: 'text', placeholder: 'e.g. London, UK' });
  location.value = prof.location || '';
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
          origin: origin.value,
          location: location.value,
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
    el('label', {}, 'From (origin)'), origin,
    el('label', {}, 'Lives in'), location,
    el('label', {}, 'Interests'), interests,
    el('label', {}, 'Speaks (native)'), nativePick,
    el('label', {}, 'Learning'), learnPick,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Save')]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, 'Edit profile'), form]));
}
