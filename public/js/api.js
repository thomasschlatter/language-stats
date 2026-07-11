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

  // --- words (graph dictionary) ---
  words: (lang, search) =>
    request('GET', `/words?lang=${encodeURIComponent(lang)}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  // A word "element": (locale, text) -> entry (or null) + its links
  entry: (lang, text) =>
    request('GET', `/words/entry?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`),
  // Where a click on a word should land, given the reader's native locale
  resolve: (text, from, to) =>
    request('GET', `/words/resolve?text=${encodeURIComponent(text)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  createWord: (b) => request('POST', '/words', b),
  linkWord: (id, b) => request('POST', `/words/${id}/links`, b),

  // --- tips ---
  tips: (lang) => request('GET', `/tips?lang=${encodeURIComponent(lang)}`),
  createTip: (b) => request('POST', '/tips', b),

  // --- articles (cards) ---  native filters cards to the learner's language
  articles: (lang, native) =>
    request('GET', `/articles?lang=${encodeURIComponent(lang)}${native ? `&native=${encodeURIComponent(native)}` : ''}`),
  article: (id) => request('GET', `/articles/${id}`),
  createArticle: (b) => request('POST', '/articles', b),
  voteArticle: (id) => request('POST', `/articles/${id}/vote`),

  // --- frequency coverage (% of conversation) ---
  coverage: (lang, t) => request('GET', `/frequency/coverage?lang=${encodeURIComponent(lang)}&t=${t}`),
  analysis: (lang, t) => request('GET', `/frequency/analysis?lang=${encodeURIComponent(lang)}&t=${t}`),

  // --- chat ---
  messages: (lang, since = 0) =>
    request('GET', `/messages?lang=${encodeURIComponent(lang)}${since ? `&since=${since}` : ''}`),
  sendMessage: (b) => request('POST', '/messages', b),
};
