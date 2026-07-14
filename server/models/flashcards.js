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
      `SELECT d.id, d.name, d.source, d.created_at, d.is_public, d.is_official, d.votes,
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

// --- shared decks: browse + upvote + copy (mirrors tips/articles) ---

export function listPublicDecks({ viewerId = null, languageId = null, q = null, level = null, limit = 30, offset = 0 }) {
  const where = ['(d.is_official = 1 OR d.is_public = 1)'];
  const params = [];
  if (languageId) { where.push('d.language_id = ?'); params.push(languageId); }
  if (level) { where.push('d.level = ?'); params.push(level); }
  if (q) { where.push('d.name LIKE ?'); params.push(`%${q}%`); }
  const rows = db.prepare(
    `SELECT d.id, d.name, d.source, d.is_official, d.level, d.votes, d.created_at,
            l.code AS lang, l.name AS lang_name, u.username AS author,
            (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id) AS total
     FROM decks d
     JOIN languages l ON l.id = d.language_id
     LEFT JOIN users u ON u.id = d.user_id
     WHERE ${where.join(' AND ')}
     ORDER BY d.is_official DESC, d.votes DESC, d.id DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  if (viewerId && rows.length) {
    const ids = rows.map((r) => r.id);
    const voted = new Set(
      db.prepare(`SELECT deck_id FROM deck_votes WHERE user_id = ? AND deck_id IN (${ids.map(() => '?').join(',')})`)
        .all(viewerId, ...ids).map((r) => r.deck_id)
    );
    for (const r of rows) r.voted = voted.has(r.id);
  }
  return rows;
}

export function getPublicDeck(id, viewerId = null) {
  const d = db.prepare(
    `SELECT d.id, d.name, d.source, d.is_official, d.level, d.votes, d.language_id, d.created_at,
            l.code AS lang, l.name AS lang_name, u.username AS author
     FROM decks d JOIN languages l ON l.id = d.language_id
     LEFT JOIN users u ON u.id = d.user_id
     WHERE d.id = ? AND (d.is_official = 1 OR d.is_public = 1)`
  ).get(id);
  if (!d) return null;
  d.total = db.prepare('SELECT COUNT(*) AS n FROM cards WHERE deck_id = ?').get(id).n;
  d.preview = db.prepare('SELECT front, back FROM cards WHERE deck_id = ? ORDER BY id LIMIT 12').all(id);
  if (viewerId) d.voted = !!db.prepare('SELECT 1 FROM deck_votes WHERE user_id = ? AND deck_id = ?').get(viewerId, id);
  return d;
}

export function voteDeck(userId, deckId) {
  const existing = db.prepare('SELECT 1 FROM deck_votes WHERE user_id = ? AND deck_id = ?').get(userId, deckId);
  db.transaction(() => {
    if (existing) {
      db.prepare('DELETE FROM deck_votes WHERE user_id = ? AND deck_id = ?').run(userId, deckId);
      db.prepare('UPDATE decks SET votes = MAX(0, votes - 1) WHERE id = ?').run(deckId);
    } else {
      db.prepare('INSERT OR IGNORE INTO deck_votes (user_id, deck_id) VALUES (?, ?)').run(userId, deckId);
      db.prepare('UPDATE decks SET votes = votes + 1 WHERE id = ?').run(deckId);
    }
  })();
  return { voted: !existing, votes: db.prepare('SELECT votes FROM decks WHERE id = ?').get(deckId)?.votes ?? 0 };
}

export function setDeckPublic(userId, deckId, isPublic) {
  return db.prepare('UPDATE decks SET is_public = ? WHERE id = ? AND user_id = ?')
    .run(isPublic ? 1 : 0, deckId, userId).changes > 0;
}

// Copy a shared deck (+ its cards, fresh SRS) into a new private study deck.
export function copyDeckForUser(userId, deckId) {
  const src = db.prepare('SELECT * FROM decks WHERE id = ? AND (is_official = 1 OR is_public = 1)').get(deckId);
  if (!src) return null;
  return db.transaction(() => {
    const info = db.prepare('INSERT INTO decks (user_id, language_id, name, source, copied_from) VALUES (?, ?, ?, ?, ?)')
      .run(userId, src.language_id, src.name, 'copy', deckId);
    const newId = info.lastInsertRowid;
    const cards = db.prepare('SELECT word_lc, front, back FROM cards WHERE deck_id = ?').all(deckId);
    const ins = db.prepare(
      "INSERT INTO cards (deck_id, user_id, language_id, word_lc, front, back, due_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    );
    for (const c of cards) ins.run(newId, userId, src.language_id, c.word_lc, c.front, c.back);
    return newId;
  })();
}

// Create an OFFICIAL deck owned by the system user (for seeded starter decks).
export function createOfficialDeck({ systemUserId, languageId, name, level = null, source = 'official' }) {
  const info = db.prepare(
    'INSERT INTO decks (user_id, language_id, name, source, is_official, is_public, level) VALUES (?, ?, ?, ?, 1, 1, ?)'
  ).run(systemUserId, languageId, name, source, level);
  return info.lastInsertRowid;
}

// Bulk-add cards. rows: [{ front, back }]. New cards are due immediately.
// Random cards (front + non-empty back) across a user's decks for a language —
// the source for the practice mini-game's questions and its distractor pool.
export function quizCards(userId, languageId, limit = 40) {
  return db.prepare(
    `SELECT c.id, c.front, c.back
       FROM cards c JOIN decks d ON d.id = c.deck_id
      WHERE c.user_id = ? AND d.language_id = ? AND c.back IS NOT NULL AND TRIM(c.back) <> ''
      ORDER BY RANDOM() LIMIT ?`
  ).all(userId, languageId, limit);
}

// Whether a deck already contains a card with this (lowercased) front word.
export function deckHasCard(deckId, wordLc) {
  return !!db.prepare('SELECT 1 FROM cards WHERE deck_id = ? AND word_lc = ? LIMIT 1').get(deckId, wordLc);
}

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

// All cards in a deck (owner-checked), in insertion order — used for export.
export function listCards(deckId, userId) {
  return db
    .prepare('SELECT front, back FROM cards WHERE deck_id = ? AND user_id = ? ORDER BY id')
    .all(deckId, userId);
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
