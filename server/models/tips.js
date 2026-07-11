// Tip queries — community language-learning advice. Each tip records which
// language it's ABOUT (language_id) and which language it's WRITTEN IN
// (body_lang_id), so every word in the body can be rendered with its locale.
import db from '../db/index.js';

export function listTips(languageId) {
  return db
    .prepare(
      `SELECT t.id, t.title, t.body, t.created_at, u.username AS author,
              bl.code AS body_lang
       FROM tips t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN languages bl ON bl.id = t.body_lang_id
       WHERE t.language_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(languageId);
}

export function createTip({ languageId, bodyLangId, userId, title, body }) {
  const info = db
    .prepare(
      `INSERT INTO tips (language_id, body_lang_id, user_id, title, body)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(languageId, bodyLangId ?? null, userId, title, body);
  return db
    .prepare(
      `SELECT t.id, t.title, t.body, t.created_at, u.username AS author,
              bl.code AS body_lang
       FROM tips t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN languages bl ON bl.id = t.body_lang_id
       WHERE t.id = ?`
    )
    .get(info.lastInsertRowid);
}
