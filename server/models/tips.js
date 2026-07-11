// Tip queries — community language-learning advice.
import db from '../db/index.js';

export function listTips(languageId) {
  return db
    .prepare(
      `SELECT t.id, t.title, t.body, t.created_at, u.username AS author
       FROM tips t
       JOIN users u ON u.id = t.user_id
       WHERE t.language_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(languageId);
}

export function createTip({ languageId, userId, title, body }) {
  const info = db
    .prepare(
      'INSERT INTO tips (language_id, user_id, title, body) VALUES (?, ?, ?, ?)'
    )
    .run(languageId, userId, title, body);
  return db
    .prepare(
      `SELECT t.id, t.title, t.body, t.created_at, u.username AS author
       FROM tips t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`
    )
    .get(info.lastInsertRowid);
}
