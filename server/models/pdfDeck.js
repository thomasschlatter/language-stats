// Extract a study VOCABULARY (word list — facts, not the document's text) from an
// uploaded PDF and build deck rows. Backs are filled from the dictionary's top
// sense for each word when available (addCards also auto-links them).
import db from '../db/index.js';

const findWord = db.prepare('SELECT id, text FROM words WHERE language_id = ? AND text = ? COLLATE NOCASE');
const topSense = db.prepare(
  `SELECT text FROM word_definitions WHERE word_id = ?
    ORDER BY (SELECT COUNT(*) FROM cards c WHERE c.definition_id = word_definitions.id) DESC, accepted DESC, id LIMIT 1`
);

export async function extractPdfCards(buffer, languageId, limit = 200) {
  const mod = await import('pdf-parse');
  const pdfParse = mod.default || mod;
  const data = await pdfParse(buffer);
  const text = String(data?.text || '');

  // Count word tokens; keep the most frequent (they're the core vocabulary).
  const freq = new Map();
  const surface = new Map(); // lc -> a real surface form to display
  for (const tok of text.split(/[^\p{L}'’-]+/u)) {
    const w = tok.replace(/^[-'’]+|[-'’]+$/g, '').trim();
    if (w.length < 3 || !/\p{L}/u.test(w)) continue;
    const lc = w.toLowerCase();
    freq.set(lc, (freq.get(lc) || 0) + 1);
    if (!surface.has(lc)) surface.set(lc, w);
  }
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, limit);

  const rows = [];
  for (const lc of ranked) {
    const w = findWord.get(languageId, lc);
    const front = w?.text || surface.get(lc) || lc;
    let back = '';
    if (w) { const s = topSense.get(w.id); if (s) back = s.text; }
    rows.push({ front, back });
  }
  return rows;
}
