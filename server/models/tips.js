// Tip queries — community language-learning advice. Each tip records which
// language it's ABOUT (language_id) and which language it's WRITTEN IN
// (body_lang_id), so every word in the body can be rendered with its locale.
import db from '../db/index.js';

// Columns returned for a tip everywhere (list + single). user_id lets the
// client show an "edit" control to the author.
const TIP_COLS = `t.id, t.title, t.body, t.created_at, t.user_id,
                  u.username AS author, bl.code AS body_lang`;
const TIP_FROM = `FROM tips t
                  JOIN users u ON u.id = t.user_id
                  LEFT JOIN languages bl ON bl.id = t.body_lang_id`;

export function listTips(languageId) {
  return db
    .prepare(`SELECT ${TIP_COLS} ${TIP_FROM} WHERE t.language_id = ? ORDER BY t.created_at DESC`)
    .all(languageId);
}

export function getTip(id) {
  return db.prepare(`SELECT ${TIP_COLS} ${TIP_FROM} WHERE t.id = ?`).get(id);
}

// Update a tip's title/body/written-in language. Only the tip's author may edit;
// returns the updated tip, or null if it doesn't exist or isn't theirs.
export function updateTip({ id, userId, title, body, bodyLangId }) {
  const owner = db.prepare('SELECT user_id FROM tips WHERE id = ?').get(id);
  if (!owner || owner.user_id !== userId) return null;
  db.prepare('UPDATE tips SET title = ?, body = ?, body_lang_id = ? WHERE id = ?')
    .run(title, body, bodyLangId ?? null, id);
  return getTip(id);
}

export function createTip({ languageId, bodyLangId, userId, title, body }) {
  const info = db
    .prepare(
      `INSERT INTO tips (language_id, body_lang_id, user_id, title, body)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(languageId, bodyLangId ?? null, userId, title, body);
  return getTip(info.lastInsertRowid);
}
