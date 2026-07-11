// Thin wrapper around the REST API. Every network call the frontend makes
// goes through here, so the API surface lives in one place.

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', // send the auth cookie
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`/api${path}`, opts);
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),

  // --- auth ---
  signup: (b) => request('POST', '/auth/signup', b),
  login: (b) => request('POST', '/auth/login', b),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),

  // --- languages ---
  languages: () => request('GET', '/languages'),

  // --- words ---
  words: (lang, search) =>
    request('GET', `/words?lang=${encodeURIComponent(lang)}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  word: (id) => request('GET', `/words/${id}`),
  createWord: (b) => request('POST', '/words', b),
  linkWord: (id, b) => request('POST', `/words/${id}/links`, b),

  // --- tips ---
  tips: (lang) => request('GET', `/tips?lang=${encodeURIComponent(lang)}`),
  createTip: (b) => request('POST', '/tips', b),
};
