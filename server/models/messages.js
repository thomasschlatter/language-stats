// Chat message queries.
import db from '../db/index.js';

const COLS = `m.id, m.body, m.created_at, u.username AS author, bl.code AS body_lang`;

// Newest messages in a room (returned oldest-first for display). When `since`
// is given, returns only messages newer than that id (for polling).
export function listMessages(languageId, since = 0, limit = 50) {
  if (since > 0) {
    return db
      .prepare(
        `SELECT ${COLS}
         FROM messages m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN languages bl ON bl.id = m.body_lang_id
         WHERE m.language_id = ? AND m.id > ?
         ORDER BY m.id ASC
         LIMIT ?`
      )
      .all(languageId, since, limit);
  }
  // Initial load: last `limit` messages, then flip to chronological order.
  const rows = db
    .prepare(
      `SELECT ${COLS}
       FROM messages m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN languages bl ON bl.id = m.body_lang_id
       WHERE m.language_id = ?
       ORDER BY m.id DESC
       LIMIT ?`
    )
    .all(languageId, limit);
  return rows.reverse();
}

export function createMessage({ languageId, bodyLangId, userId, body }) {
  const info = db
    .prepare(
      'INSERT INTO messages (language_id, body_lang_id, user_id, body) VALUES (?, ?, ?, ?)'
    )
    .run(languageId, bodyLangId ?? null, userId, body);
  return db
    .prepare(
      `SELECT ${COLS}
       FROM messages m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN languages bl ON bl.id = m.body_lang_id
       WHERE m.id = ?`
    )
    .get(info.lastInsertRowid);
}
