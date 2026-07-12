// Fetch a word's definition from the Wiktionary REST API (English Wiktionary,
// which carries definitions for many languages of a given spelling).
// Returns a short definition string, or null if none.

const UA = 'language-stats/0.1 (https://github.com/thomasschlatter/language-stats; educational project)';
const REST = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

const stripHtml = (s) =>
  s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export async function fetchDefinition(word, baseLang, { timeoutMs = 4000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(REST + encodeURIComponent(word), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entries = data[baseLang];
    if (!Array.isArray(entries) || !entries.length) return null;
    const e = entries[0];
    const defs = (e.definitions || []).map((d) => stripHtml(d.definition || '')).filter(Boolean).slice(0, 2);
    if (!defs.length) return null;
    return (e.partOfSpeech ? `(${e.partOfSpeech}) ` : '') + defs.join('; ');
  } finally {
    clearTimeout(timer);
  }
}
