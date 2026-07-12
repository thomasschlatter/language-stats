// Fetch a word's definitions from the Wiktionary REST API (English Wiktionary,
// which carries definitions for many languages of a given spelling).
// Returns an array of short definition strings (multiple parts of speech /
// senses), or [] if none.

const UA = 'language-stats/0.1 (https://github.com/thomasschlatter/language-stats; educational project)';
const REST = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

const stripHtml = (s) =>
  s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export async function fetchDefinitions(word, baseLang, { timeoutMs = 4000, max = 6 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(REST + encodeURIComponent(word), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entries = data[baseLang];
    if (!Array.isArray(entries)) return [];

    // Real parts of speech first; symbols / codes / letters last.
    const POS_ORDER = ['Noun', 'Proper noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun',
      'Preposition', 'Conjunction', 'Interjection', 'Article', 'Determiner', 'Numeral', 'Particle'];
    const rank = (pos) => { const i = POS_ORDER.indexOf(pos); return i === -1 ? 99 : i; };
    const sorted = [...entries].sort((a, b) => rank(a.partOfSpeech) - rank(b.partOfSpeech));

    const out = [];
    for (const e of sorted) {
      // First couple of senses per part of speech.
      const senses = (e.definitions || []).map((d) => stripHtml(d.definition || '')).filter(Boolean).slice(0, 2);
      for (const s of senses) {
        out.push(e.partOfSpeech ? `(${e.partOfSpeech}) ${s}` : s);
        if (out.length >= max) return out;
      }
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
