// Flashcard deck + card queries and SRS review.
import db from '../db/index.js';
import { schedule, maturity } from '../lib/srs.js';

export function createDeck({ userId, languageId, name, source }) {
  const info = db
    .prepare('INSERT INTO decks (user_id, language_id, name, source) VALUES (?, ?, ?, ?)')
    .run(userId, languageId, name, source ?? null);
  return getDeck(info.lastInsertRowid, userId);
}

export function getDeck(id, userId) {
  return db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?').get(id, userId);
}

export function listDecks(userId) {
  return db
    .prepare(
      `SELECT d.id, d.name, d.source, d.created_at,
              l.code AS lang, l.name AS lang_name,
              (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id) AS total,
              (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id AND c.due_at <= datetime('now')) AS due
       FROM decks d
       JOIN languages l ON l.id = d.language_id
       WHERE d.user_id = ?
       ORDER BY d.created_at DESC`
    )
    .all(userId);
}

export function deleteDeck(id, userId) {
  return db.prepare('DELETE FROM decks WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
}

// Bulk-add cards. rows: [{ front, back }]. New cards are due immediately.
export function addCards({ deckId, userId, languageId, rows }) {
  const stmt = db.prepare(
    `INSERT INTO cards (deck_id, user_id, language_id, word_lc, front, back, due_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const tx = db.transaction((list) => {
    let n = 0;
    for (const r of list) {
      const front = (r.front || '').trim();
      if (!front) continue;
      stmt.run(deckId, userId, languageId, front.toLowerCase(), front, (r.back || '').trim() || null);
      n += 1;
    }
    return n;
  });
  return tx(rows);
}

export function dueCards(userId, deckId, limit = 40) {
  if (deckId) {
    return db
      .prepare(
        `SELECT * FROM cards WHERE user_id = ? AND deck_id = ? AND due_at <= datetime('now')
         ORDER BY due_at LIMIT ?`
      )
      .all(userId, deckId, limit);
  }
  return db
    .prepare(
      `SELECT * FROM cards WHERE user_id = ? AND due_at <= datetime('now') ORDER BY due_at LIMIT ?`
    )
    .all(userId, limit);
}

export function getCard(id, userId) {
  return db.prepare('SELECT * FROM cards WHERE id = ? AND user_id = ?').get(id, userId);
}

// Apply a rating (1..4) and reschedule.
export function reviewCard(id, userId, rating) {
  const card = getCard(id, userId);
  if (!card) return null;
  const next = schedule(card, rating);
  db.prepare(
    `UPDATE cards SET ease = ?, interval = ?, reps = ?, lapses = ?, state = ?,
       due_at = datetime('now', '+' || ? || ' days')
     WHERE id = ? AND user_id = ?`
  ).run(next.ease, next.interval, next.reps, next.lapses, next.state, next.dueInDays, id, userId);
  return { ...getCard(id, userId), scheduled: next };
}

// { word_lc: maturity 0..1 } for every word the user has a card for — drives
// studied-mode colouring; presence means "in a deck".
export function familiarityMap(userId, languageId) {
  const rows = db
    .prepare(
      `SELECT word_lc, MAX(interval) AS mx
       FROM cards
       WHERE user_id = ? AND language_id = ? AND word_lc IS NOT NULL AND word_lc <> ''
       GROUP BY word_lc`
    )
    .all(userId, languageId);
  const map = {};
  for (const r of rows) map[r.word_lc] = maturity(r.mx);
  return map;
}
