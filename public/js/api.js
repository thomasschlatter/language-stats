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
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
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
  changePassword: (b) => request('POST', '/auth/change-password', b),
  deleteAccount: () => request('DELETE', '/auth/account'),

  // --- languages ---
  languages: () => request('GET', '/languages'),
  createLanguage: (b) => request('POST', '/languages', b),
  deleteLanguage: (code) => request('DELETE', `/languages/${encodeURIComponent(code)}`),

  // --- words (graph dictionary) ---
  words: (lang, search) =>
    request('GET', `/words?lang=${encodeURIComponent(lang)}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  searchWords: (q) => request('GET', `/words/search?q=${encodeURIComponent(q)}`),
  // A word "element": (locale, text) -> entry (or null) + its links
  entry: (lang, text) =>
    request('GET', `/words/entry?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`),
  // Where a click on a word should land, given the reader's native locale
  resolve: (text, from, to) =>
    request('GET', `/words/resolve?text=${encodeURIComponent(text)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  createWord: (b) => request('POST', '/words', b),
  linkWord: (id, b) => request('POST', `/words/${id}/links`, b),
  addDefinition: (wordId, b) => request('POST', `/words/${wordId}/definitions`, b),
  voteDefinition: (id) => request('POST', `/words/def/${id}/vote`),

  // --- tips ---
  tips: (lang) => request('GET', `/tips?lang=${encodeURIComponent(lang)}`),
  tip: (id) => request('GET', `/tips/${id}`),
  createTip: (b) => request('POST', '/tips', b),
  updateTip: (id, b) => request('PUT', `/tips/${id}`, b),
  voteTip: (id) => request('POST', `/tips/${id}/vote`),

  // --- articles (cards) ---  native filters cards to the learner's language
  articles: (lang, native) =>
    request('GET', `/articles?lang=${encodeURIComponent(lang)}${native ? `&native=${encodeURIComponent(native)}` : ''}`),
  article: (id) => request('GET', `/articles/${id}`),
  createArticle: (b) => request('POST', '/articles', b),
  translateArticle: (id, b) => request('POST', `/articles/${id}/translate`, b),
  voteArticle: (id) => request('POST', `/articles/${id}/vote`),

  // --- frequency coverage (% of conversation) ---
  coverage: (lang, t) => request('GET', `/frequency/coverage?lang=${encodeURIComponent(lang)}&t=${t}`),
  analysis: (lang, t) => request('GET', `/frequency/analysis?lang=${encodeURIComponent(lang)}&t=${t}`),
  genderNouns: (lang, t = 1, limit = 500) => request('GET', `/frequency/gender-nouns?lang=${encodeURIComponent(lang)}&t=${t}&limit=${limit}`),

  // --- chat ---
  messages: (lang, since = 0) =>
    request('GET', `/messages?lang=${encodeURIComponent(lang)}${since ? `&since=${since}` : ''}`),
  sendMessage: (b) => request('POST', '/messages', b),

  // --- profiles ---
  myProfile: () => request('GET', '/profile'),
  updateProfile: (b) => request('PUT', '/profile', b),
  setLanguageLevel: (languageCode, level) => request('PUT', '/profile/language-level', { languageCode, level }),
  uploadAvatarImage: (dataUrl) => request('POST', '/profile/avatar-image', { dataUrl }),
  removeAvatarImage: () => request('DELETE', '/profile/avatar-image'),
  userProfile: (username) => request('GET', `/users/${encodeURIComponent(username)}`),
  followUser: (username) => request('POST', `/users/${encodeURIComponent(username)}/follow`),
  blockUser: (username) => request('POST', `/users/${encodeURIComponent(username)}/block`),
  report: (b) => request('POST', '/reports', b),
  community: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request('GET', `/community${qs ? `?${qs}` : ''}`);
  },

  // --- direct messages ---
  conversations: () => request('GET', '/dm'),
  dmUnread: () => request('GET', '/dm/unread'),
  dmThread: (username, since = 0) =>
    request('GET', `/dm/${encodeURIComponent(username)}${since ? `?since=${since}` : ''}`),
  sendDM: (username, b) => request('POST', `/dm/${encodeURIComponent(username)}`, b),
  correctMessage: (id, b) => request('POST', `/dm/messages/${id}/correct`, b),
  translate: (text, from, to) => request('POST', '/translate', { text, from, to }),
  aiTranslate: (text, from, to) => request('POST', '/translate/ai', { text, from, to }),

  // --- multiplayer world ---
  world: () => request('GET', '/world'),

  // --- progress / stats ---
  progress: (lang) => request('GET', `/progress?lang=${encodeURIComponent(lang)}`),
  rundown: () => request('GET', '/progress/rundown'),
  resetFamiliarity: (lang) => request('POST', '/progress/reset', { lang }),
  wordProgress: (lang, word) =>
    request('GET', `/progress/word?lang=${encodeURIComponent(lang)}&word=${encodeURIComponent(word)}`),
  markWord: (b) => request('POST', '/progress/mark', b),
  // seen-count tracking (red→green familiarity coloring)
  seenMap: (lang) => request('GET', `/progress/seen?lang=${encodeURIComponent(lang)}`),
  recordSeen: (b) => request('POST', '/progress/seen', b),
  seenPolicy: () => request('GET', '/progress/policy'),

  // --- flashcards / SRS ---
  decks: () => request('GET', '/flashcards/decks'),
  createDeck: (b) => request('POST', '/flashcards/decks', b),
  deleteDeck: (id) => request('DELETE', `/flashcards/decks/${id}`),
  addCard: (deckId, b) => request('POST', `/flashcards/decks/${deckId}/cards`, b),
  importDeck: (b) => request('POST', '/flashcards/import', b),
  importApkg: (b) => request('POST', '/flashcards/import-apkg', b),
  generateDeck: (b) => request('POST', '/flashcards/generate', b),
  genderDeck: (b) => request('POST', '/flashcards/gender-deck', b),
  study: (deckId) => request('GET', `/flashcards/study${deckId ? `?deck=${deckId}` : ''}`),
  review: (b) => request('POST', '/flashcards/review', b),
  familiarity: (lang) => request('GET', `/flashcards/familiarity?lang=${encodeURIComponent(lang)}`),
};
