// Word-frequency queries — powers the "% of conversation" coverage widget.
import db from '../db/index.js';

export function frequencyLoaded(languageId) {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM word_frequencies WHERE language_id = ?')
    .get(languageId);
  return row.n > 0;
}

// The N most frequent words (cased form), most-frequent first.
export function topWords(languageId, limit = 30) {
  return db
    .prepare(
      `SELECT f.rank, COALESCE(l.form, f.word) AS word
       FROM word_frequencies f
       LEFT JOIN lexicon l ON l.language_id = f.language_id AND l.word_lc = f.word
       WHERE f.language_id = ?
       ORDER BY f.rank
       LIMIT ?`
    )
    .all(languageId, limit);
}

export function totalCount(languageId) {
  const row = db
    .prepare('SELECT MAX(cum) AS total FROM word_frequencies WHERE language_id = ?')
    .get(languageId);
  return row?.total || 0;
}

// The set of top words whose cumulative frequency first reaches `threshold`
// (a fraction 0..1) of all tokens. Returns how many words are needed plus the
// list itself (capped for display; the true count is `wordsNeeded`).
export function coverage(languageId, threshold, cap = 500) {
  const total = totalCount(languageId);
  if (!total) return { total: 0, threshold, wordsNeeded: 0, words: [], capped: false };

  const target = threshold * total;

  // Number of words needed: every word whose *previous* cumulative was still
  // below the target must be included (so the boundary word is counted).
  const needed = db
    .prepare(
      `SELECT COUNT(*) AS n FROM word_frequencies
       WHERE language_id = ? AND (cum - count) < ?`
    )
    .get(languageId, target).n;

  // Join the lexicon to show the correctly-cased German form (nouns capitalised)
  // instead of the lowercased frequency-list token.
  const words = db
    .prepare(
      `SELECT f.rank, COALESCE(l.form, f.word) AS word, f.count
       FROM word_frequencies f
       LEFT JOIN lexicon l ON l.language_id = f.language_id AND l.word_lc = f.word
       WHERE f.language_id = ? AND (f.cum - f.count) < ?
       ORDER BY f.rank
       LIMIT ?`
    )
    .all(languageId, target, cap);

  return {
    total,
    threshold,
    wordsNeeded: needed,
    words,
    capped: needed > words.length,
  };
}
