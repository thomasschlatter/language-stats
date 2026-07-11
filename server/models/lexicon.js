// Lexicon queries (POS + gender per word form).
import db from '../db/index.js';

export function lexiconLoaded(languageId) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM lexicon WHERE language_id = ?').get(languageId);
  return row.n > 0;
}
