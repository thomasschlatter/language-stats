// Minimal shared app state. Not a framework — just a tiny observable object
// so views can react to login/logout without a heavy dependency.

const listeners = new Set();

export const store = {
  user: null,        // { id, email, username } or null
  languages: [],     // [{ id, code, name }]

  set(patch) {
    Object.assign(this, patch);
    listeners.forEach((fn) => fn(this));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
