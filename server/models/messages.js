// Chat message queries.
import db from '../db/index.js';

const COLS = `m.id, m.body, m.created_at, u.id AS author_id, u.username AS author, u.avatar AS author_avatar, bl.code AS body_lang`;

function parseAvatar(row) {
  if (row && row.author_avatar) {
    try { row.author_avatar = JSON.parse(row.author_avatar); } catch { row.author_avatar = null; }
  }
  return row;
}

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
      .all(languageId, since, limit)
      .map(parseAvatar);
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
    .all(languageId, limit)
    .map(parseAvatar);
  return rows.reverse();
}

export function createMessage({ languageId, bodyLangId, userId, body }) {
  const info = db
    .prepare(
      'INSERT INTO messages (language_id, body_lang_id, user_id, body) VALUES (?, ?, ?, ?)'
    )
    .run(languageId, bodyLangId ?? null, userId, body);
  const row = db
    .prepare(
      `SELECT ${COLS}
       FROM messages m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN languages bl ON bl.id = m.body_lang_id
       WHERE m.id = ?`
    )
    .get(info.lastInsertRowid);
  return parseAvatar(row);
}
