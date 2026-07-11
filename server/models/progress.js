// Per-user word progress + the stats that make it meaningful:
//   * how many words you know / are learning
//   * what share of everyday conversation those known words cover
//   * which frequent words to learn next
import db from '../db/index.js';
import { totalCount } from './frequency.js';

// Mark a word. status 'known' | 'learning' upserts; 'none' clears it.
export function markWord({ userId, languageId, wordLc, status }) {
  if (status === 'none') {
    db.prepare('DELETE FROM user_words WHERE user_id = ? AND language_id = ? AND word_lc = ?')
      .run(userId, languageId, wordLc);
    return { status: 'none' };
  }
  db.prepare(
    `INSERT INTO user_words (user_id, language_id, word_lc, status, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, language_id, word_lc)
       DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`
  ).run(userId, languageId, wordLc, status);
  return { status };
}

export function wordStatus(userId, languageId, wordLc) {
  const row = db
    .prepare('SELECT status FROM user_words WHERE user_id = ? AND language_id = ? AND word_lc = ?')
    .get(userId, languageId, wordLc);
  return row?.status || 'none';
}

export function summary(userId, languageId) {
  const counts = db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM user_words
       WHERE user_id = ? AND language_id = ? GROUP BY status`
    )
    .all(userId, languageId);
  const known = counts.find((c) => c.status === 'known')?.n || 0;
  const learning = counts.find((c) => c.status === 'learning')?.n || 0;

  // Share of all corpus tokens covered by the user's KNOWN words.
  const total = totalCount(languageId);
  const covered = total
    ? db
        .prepare(
          `SELECT COALESCE(SUM(f.count), 0) AS c
           FROM word_frequencies f
           JOIN user_words uw
             ON uw.language_id = f.language_id AND uw.word_lc = f.word
           WHERE uw.user_id = ? AND uw.language_id = ? AND uw.status = 'known'`
        )
        .get(userId, languageId).c
    : 0;

  return {
    known,
    learning,
    coveragePct: total ? +((covered / total) * 100).toFixed(1) : null,
    hasFrequency: !!total,
  };
}

// The most frequent words the user does NOT yet know — "learn these next".
export function suggestions(userId, languageId, limit = 40) {
  return db
    .prepare(
      `SELECT f.rank, COALESCE(l.form, f.word) AS word, f.count
       FROM word_frequencies f
       LEFT JOIN lexicon l ON l.language_id = f.language_id AND l.word_lc = f.word
       WHERE f.language_id = ?
         AND f.word NOT IN (
           SELECT word_lc FROM user_words
           WHERE user_id = ? AND language_id = ? AND status = 'known'
         )
       ORDER BY f.rank
       LIMIT ?`
    )
    .all(languageId, userId, languageId, limit);
}
