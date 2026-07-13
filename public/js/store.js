// Minimal shared app state. Not a framework — just a tiny observable object
// so views can react to login/logout and native-language changes.

const listeners = new Set();
const NATIVE_KEY = 'ls_native_lang';
const LEARNING_KEY = 'ls_learning_langs';

function loadLearning() {
  try { return new Set(JSON.parse(localStorage.getItem(LEARNING_KEY) || '[]')); }
  catch { return new Set(); }
}

export const store = {
  user: null,        // { id, email, username } or null
  languages: [],     // [{ id, code, lang, country, name }]
  // The reader's native locale. Clicking a word takes you to its translation
  // in THIS locale. Persisted in localStorage so it survives reloads.
  nativeLang: localStorage.getItem(NATIVE_KEY) || 'en-US',
  // The set of language codes the user is learning (shown first in the carousel).
  learning: loadLearning(),

  set(patch) {
    Object.assign(this, patch);
    listeners.forEach((fn) => fn(this));
  },
  setNative(code) {
    localStorage.setItem(NATIVE_KEY, code);
    this.set({ nativeLang: code });
  },
  isLearning(code) {
    return this.learning.has(code);
  },
  setLearning(codes) {
    const next = new Set(codes);
    localStorage.setItem(LEARNING_KEY, JSON.stringify([...next]));
    this.set({ learning: next });
  },
  addLearning(code) {
    if (this.learning.has(code)) return;
    this.setLearning([...this.learning, code]);
  },
  removeLearning(code) {
    if (!this.learning.has(code)) return;
    this.setLearning([...this.learning].filter((c) => c !== code));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
