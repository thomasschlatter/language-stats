// User profile page (#/u/:username): shows native/learning languages, bio,
// interests. If it's your own profile, you can edit it. (Follow + Message
// buttons are added in Feature 2/3.)

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { avatarFor } from '../avatar.js';
import { nativeSelector, logout } from '../auth.js';
import { byImportance } from '../langOrder.js';
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
        avatarFor(prof.avatar, prof.username, 64, prof.avatar_image),
        el('div', {}, [
          el('h1', { style: 'margin:0' }, `@${prof.username}`),
          el('div', { class: 'muted' }, `member since ${(prof.created_at || '').slice(0, 10)}`),
        ]),
        el('div', { class: 'spacer' }),
        isMe
          ? el('div', { class: 'row' }, [
              el('button', { class: 'btn small', onclick: () => openCharacterCreator(prof.avatar, () => renderUserProfile(prof.username)) }, prof.avatar ? 'Edit character' : 'Create character'),
              el('button', { class: 'btn small secondary', onclick: () => pickAvatarImage(prof) }, prof.avatar_image ? 'Change photo' : 'Use a photo'),
              prof.avatar_image
                ? el('button', { class: 'btn small secondary', onclick: () => removeAvatarImage(prof) }, 'Remove photo')
                : null,
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
    view.append(learningLanguagesSetting());
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

// Downscale a chosen image file to a small square-ish JPEG data URL (keeps
// uploads tiny). Returns a data: URL string.
function fileToResizedDataUrl(file, max = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

// Pick a photo from disk, resize it, and set it as the avatar.
function pickAvatarImage(prof) {
  const input = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: 'display:none' });
  document.body.append(input);
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 256);
      const { avatar_image } = await api.uploadAvatarImage(dataUrl);
      if (store.user) store.set({ user: { ...store.user, avatar_image } }); // refresh top bar
      renderUserProfile(prof.username);
    } catch (ex) {
      console.error('avatar upload failed:', ex.message);
    }
  });
  input.click();
}

async function removeAvatarImage(prof) {
  try {
    await api.removeAvatarImage();
    if (store.user) store.set({ user: { ...store.user, avatar_image: null } });
    renderUserProfile(prof.username);
  } catch (ex) { console.error(ex.message); }
}

// Persist the current learning set (carousel) to the server so it survives
// across devices, not just in localStorage.
function persistLearning() {
  if (!store.user) return;
  const learning = [...store.learning].filter((c) => c !== store.nativeLang);
  api.updateProfile({ learning }).catch(() => {});
}

// Manage the languages you're learning (the top-bar carousel set) from your
// profile. Add/remove here mirrors the carousel; native language is excluded.
function learningLanguagesSetting() {
  const learning = store.languages
    .filter((l) => store.isLearning(l.code) && l.code !== store.nativeLang)
    .sort(byImportance);
  const available = store.languages
    .filter((l) => !store.isLearning(l.code) && l.code !== store.nativeLang)
    .sort(byImportance);

  return el('div', { class: 'prof-setting' }, [
    el('span', { class: 'prof-langs-label' }, 'Languages you’re learning'),
    el('div', { class: 'learn-pills' },
      learning.length
        ? learning.map((l) =>
            el('span', { class: 'lang-pill removable' }, [
              l.name,
              el('button', {
                class: 'lang-pill-x', title: `Remove ${l.name}`,
                onclick: () => { store.removeLearning(l.code); persistLearning(); },
              }, '×'),
            ]))
        : el('span', { class: 'muted' }, 'None yet — add one below.')
    ),
    el('select', {
      class: 'native-select',
      onchange: (e) => { if (e.target.value) { store.addLearning(e.target.value); persistLearning(); } },
    }, [
      el('option', { value: '' }, '+ Add a language…'),
      ...available.map((l) => el('option', { value: l.code }, l.name)),
    ]),
  ]);
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
