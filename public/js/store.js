// Minimal shared app state. Not a framework — just a tiny observable object
// so views can react to login/logout and native-language changes.

const listeners = new Set();
const NATIVE_KEY = 'ls_native_lang';

export const store = {
  user: null,        // { id, email, username } or null
  languages: [],     // [{ id, code, lang, country, name }]
  // The reader's native locale. Clicking a word takes you to its translation
  // in THIS locale. Persisted in localStorage so it survives reloads.
  nativeLang: localStorage.getItem(NATIVE_KEY) || 'en-US',

  set(patch) {
    Object.assign(this, patch);
    listeners.forEach((fn) => fn(this));
  },
  setNative(code) {
    localStorage.setItem(NATIVE_KEY, code);
    this.set({ nativeLang: code });
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
