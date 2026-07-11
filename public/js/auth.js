// Auth UI: renders the top-bar area and the login/signup modal.

import { api } from './api.js';
import { store } from './store.js';
import { el, openModal, clear } from './dom.js';

// Load the current user on startup (if a valid cookie exists).
export async function loadCurrentUser() {
  try {
    const { user } = await api.me();
    store.set({ user });
  } catch {
    store.set({ user: null });
  }
}

// A "My native language" picker — clicking any word translates INTO this
// locale. Lives in the top bar so it's always one glance away.
function nativeSelector() {
  const select = el(
    'select',
    { class: 'native-select', title: 'Your native language — words translate into this', onchange: (e) => store.setNative(e.target.value) },
    store.languages.map((l) =>
      el('option', { value: l.code, selected: l.code === store.nativeLang ? '' : null }, l.name)
    )
  );
  return el('span', { class: 'native-picker' }, [el('span', { class: 'who' }, 'Native:'), select]);
}

// Render the top-right controls (native picker + auth) based on store.user.
export function renderAuthArea() {
  const area = clear(document.getElementById('auth-area'));
  area.append(nativeSelector());
  if (store.user) {
    area.append(
      el('a', { class: 'who', href: `#/u/${encodeURIComponent(store.user.username)}`, title: 'Your profile' }, `@${store.user.username}`),
      el('button', { class: 'btn secondary small', onclick: doLogout }, 'Sign out')
    );
  } else {
    area.append(
      el('button', { class: 'btn secondary small', onclick: () => openAuthModal('login') }, 'Sign in'),
      el('button', { class: 'btn small', onclick: () => openAuthModal('signup') }, 'Sign up')
    );
  }
}

async function doLogout() {
  await api.logout();
  store.set({ user: null });
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
      } catch (ex) {
        err.textContent = ex.message;
      }
    },
  });

  form.append(
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
    ])
  );

  const close = openModal(el('div', {}, [title, form]));
}
