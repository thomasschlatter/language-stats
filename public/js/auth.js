// Auth UI: renders the top-bar area and the login/signup modal.

import { api } from './api.js';
import { store } from './store.js';
import { el, openModal, clear } from './dom.js';
import { colorModeToggle } from './seen.js';
import { avatarFor } from './avatar.js';
import { byImportance } from './langOrder.js';

// Load the current user on startup (if a valid cookie exists).
export async function loadCurrentUser() {
  try {
    const { user } = await api.me();
    store.set({ user });
    // Server is the source of truth for the learning set (syncs the carousel
    // across devices). Only override if the server actually has languages, so a
    // returning user's local carousel isn't wiped by an empty server list.
    if (user.learning && user.learning.length) store.setLearning(user.learning);
  } catch {
    store.set({ user: null });
  }
}

// A "My native language" picker — clicking any word translates INTO this
// locale. Now lives on the profile page.
export function nativeSelector() {
  const select = el(
    'select',
    { class: 'native-select', title: 'Your native language — words translate into this', onchange: (e) => store.setNative(e.target.value) },
    store.languages.map((l) =>
      el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.name)
    )
  );
  return el('span', { class: 'native-picker' }, [el('span', { class: 'who' }, 'Native language:'), select]);
}

// Render the top-right controls based on store.user. Kept minimal: signed-in
// users just see their character (→ profile), where native language, progress
// and sign-out now live. (Colour mode stays here as a quick display toggle.)
export function renderAuthArea() {
  // Gate account-only sections (nav links marked .auth-only) on login state.
  document.body.classList.toggle('authed', !!store.user);
  const area = clear(document.getElementById('auth-area'));
  if (store.user) {
    const link = el('a', {
      class: 'me-avatar', href: `#/u/${encodeURIComponent(store.user.username)}`,
      title: `${store.user.username} — your profile`,
    }, avatarFor(store.user.avatar, store.user.username, 34, store.user.avatar_image));
    area.append(colorModeToggle(), link);
  } else {
    area.append(
      el('button', { class: 'btn secondary small', onclick: () => openAuthModal('login') }, 'Sign in'),
      el('button', { class: 'btn small', onclick: () => openAuthModal('signup') }, 'Sign up')
    );
  }
}

// Sign out — moved off the top bar; called from the profile page.
export async function logout() {
  await api.logout();
  store.set({ user: null });
  window.location.hash = '#/';
}

// Open the sign-in modal directly (used by inline prompts).
export function promptSignIn() {
  openAuthModal('login');
}

// First-run language setup — pick your native language and what you're learning.
// Shown right after signing up (email or LINE).
export function openLanguageSetup(onDone = () => {}) {
  const err = el('div', { class: 'error' });
  const nativeSel = el('select', {},
    store.languages.map((l) => el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.name)));
  // Scrollable, clearly-toggled language list (same picker style as the options).
  const langs = [...store.languages].sort(byImportance);
  const selected = new Set(langs.filter((l) => store.isLearning(l.code)).map((l) => l.code));
  const checklist = el('div', { class: 'lang-picker-list' }, langs.map((l) => {
    const item = el('button', {
      type: 'button',
      class: 'lang-picker-item' + (selected.has(l.code) ? ' selected' : ''),
      onclick: () => {
        if (selected.has(l.code)) { selected.delete(l.code); item.classList.remove('selected'); }
        else { selected.add(l.code); item.classList.add('selected'); }
      },
    }, [el('span', {}, l.name), el('span', { class: 'check' }, '✓')]);
    return item;
  }));

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      const native = nativeSel.value;
      const learning = [...selected].filter((c) => c !== native);
      store.setNative(native);
      store.setLearning(learning);
      if (store.user) { try { await api.updateProfile({ native: [native], learning }); } catch { /* ignore */ } }
      close();
      onDone();
    },
  }, [
    el('label', {}, 'Your native language'),
    el('div', { class: 'muted', style: 'font-size:0.78rem; margin-bottom:0.3rem' }, 'Words you click translate into this language.'),
    nativeSel,
    el('label', { style: 'margin-top:0.75rem' }, 'Languages you want to learn'),
    checklist,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [el('button', { class: 'btn', type: 'submit' }, 'Start learning')]),
  ]);

  const close = openModal(el('div', {}, [el('h2', {}, 'Welcome! Set up your languages 🌍'), form]));
}

// One-time getting-started shown right after signup.
function showWelcome() {
  const close = openModal(el('div', {}, [
    el('h2', {}, 'Welcome to Groupifier 👋'),
    el('p', { class: 'muted' }, 'A quick way to get going:'),
    el('ol', { class: 'welcome-steps' }, [
      el('li', {}, 'Set the languages you speak and are learning, and make your character.'),
      el('li', {}, 'Read a card, or generate a flashcard deck to start on vocabulary.'),
      el('li', {}, 'Find a language partner in Community and say hi.'),
    ]),
    el('div', { class: 'row', style: 'justify-content:flex-end; gap:0.5rem; margin-top:1.25rem' }, [
      el('button', { class: 'btn secondary', type: 'button', onclick: () => close() }, 'Explore on my own'),
      el('a', { class: 'btn', href: '#/settings', onclick: () => close() }, 'Set up my profile'),
    ]),
  ]));
}

// An inline "Sign in <to do X>" prompt: a real button + plain helper text, so
// it reads as an action rather than a row of clickable dictionary words.
export function signInPrompt(text) {
  return el('span', { class: 'signin-prompt muted' }, [
    el('button', { class: 'btn small', type: 'button', onclick: () => openAuthModal('login') }, 'Sign in'),
    text ? ` ${text}` : null,
  ]);
}

function openAuthModal(mode) {
  const err = el('div', { class: 'error' });
  const emailInput = el('input', { type: 'email', placeholder: 'you@example.com' });
  const userInput = el('input', { type: 'text', placeholder: 'username' });
  const passInput = el('input', { type: 'password', placeholder: 'password (min 6 chars)' });

  const title = el('h2', {}, mode === 'signup' ? 'Create an account' : 'Sign in');

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        const payload =
          mode === 'signup'
            ? { email: emailInput.value, username: userInput.value, password: passInput.value }
            : { email: emailInput.value, password: passInput.value };
        const { user } = mode === 'signup' ? await api.signup(payload) : await api.login(payload);
        store.set({ user });
        close();
        if (mode === 'signup') openLanguageSetup(showWelcome);
      } catch (ex) {
        err.textContent = ex.message;
      }
    },
  });

  // Note: Node.append() stringifies null to the text "null", so filter nulls out.
  [
    el('label', {}, 'Email'),
    emailInput,
    mode === 'signup' ? el('label', {}, 'Username') : null,
    mode === 'signup' ? userInput : null,
    el('label', {}, 'Password'),
    passInput,
    err,
    el('div', { class: 'row', style: 'margin-top:1rem' }, [
      el('button', { class: 'btn', type: 'submit' }, mode === 'signup' ? 'Sign up' : 'Sign in'),
      el('button', {
        class: 'btn link',
        type: 'button',
        onclick: () => {
          close();
          openAuthModal(mode === 'signup' ? 'login' : 'signup');
        },
      }, mode === 'signup' ? 'Have an account? Sign in' : 'New here? Sign up'),
    ]),
  ].filter(Boolean).forEach((child) => form.append(child));

  // Social login: hand off to the server's LINE OAuth flow (full-page redirect).
  const lineBtn = el('button', {
    class: 'btn line-btn', type: 'button',
    onclick: () => { window.location.href = '/api/auth/line'; },
  }, [el('span', { class: 'line-badge' }, 'LINE'), ' Log in with LINE']);

  // LINE's login page blocks sign-in inside in-app browsers (Facebook, Instagram,
  // Messenger, etc.), which is a common cause of "cannot log in" on iPhones.
  // Warn and offer to copy the link so they can open it in Safari/Chrome.
  const notice = isInAppBrowser()
    ? el('div', { class: 'inapp-notice' }, [
        el('div', {}, '⚠️ LINE login often fails inside in-app browsers. For best results, open this site in Safari or Chrome.'),
        el('button', {
          class: 'btn small secondary', type: 'button', style: 'margin-top:0.5rem',
          onclick: async (e) => {
            const url = window.location.href.split('#')[0];
            try { await navigator.clipboard.writeText(url); e.target.textContent = '✓ Link copied — paste in Safari'; }
            catch { e.target.textContent = url; }
          },
        }, 'Copy link to open in Safari'),
      ])
    : null;

  const close = openModal(el('div', {}, [
    title, form,
    el('div', { class: 'auth-divider' }, 'or'),
    lineBtn,
    notice,
  ].filter(Boolean)));
}

// Detects common in-app browsers (webviews) where LINE/OAuth logins are blocked.
export function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  // Facebook, Instagram, Messenger, TikTok, WeChat, KakaoTalk, Snapchat, and
  // generic Android WebViews. (LINE's own browser handles LINE login fine.)
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|MicroMessenger|KAKAOTALK|Snapchat|BytedanceWebview|musical_ly|TikTok|; wv\)/i.test(ua);
}
