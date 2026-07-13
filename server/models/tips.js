// Tip queries — community language-learning advice. Each tip records which
// language it's ABOUT (language_id) and which language it's WRITTEN IN
// (body_lang_id), so every word in the body can be rendered with its locale.
import db from '../db/index.js';

// Columns returned for a tip everywhere (list + single). user_id lets the
// client show an "edit" control to the author; votes powers upvote ranking.
const TIP_COLS = `t.id, t.title, t.body, t.created_at, t.user_id,
                  u.username AS author, bl.code AS body_lang,
                  (SELECT COUNT(*) FROM tip_votes tv WHERE tv.tip_id = t.id) AS votes`;
const TIP_FROM = `FROM tips t
                  JOIN users u ON u.id = t.user_id
                  LEFT JOIN languages bl ON bl.id = t.body_lang_id`;

// Tips ranked by upvotes (then most recent).
export function listTips(languageId) {
  return db
    .prepare(`SELECT ${TIP_COLS} ${TIP_FROM} WHERE t.language_id = ? ORDER BY votes DESC, t.created_at DESC`)
    .all(languageId);
}

export function tipVoteCount(tipId) {
  return db.prepare('SELECT COUNT(*) AS n FROM tip_votes WHERE tip_id = ?').get(tipId).n;
}

export function tipUserVoted(tipId, userId) {
  return !!db.prepare('SELECT 1 FROM tip_votes WHERE tip_id = ? AND user_id = ?').get(tipId, userId);
}

export function tipVotedIds(userId, ids) {
  if (!ids.length) return new Set();
  const ph = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT tip_id FROM tip_votes WHERE user_id = ? AND tip_id IN (${ph})`).all(userId, ...ids);
  return new Set(rows.map((r) => r.tip_id));
}

export function toggleTipVote(tipId, userId) {
  if (tipUserVoted(tipId, userId)) {
    db.prepare('DELETE FROM tip_votes WHERE tip_id = ? AND user_id = ?').run(tipId, userId);
    return { voted: false, votes: tipVoteCount(tipId) };
  }
  db.prepare('INSERT INTO tip_votes (tip_id, user_id) VALUES (?, ?)').run(tipId, userId);
  return { voted: true, votes: tipVoteCount(tipId) };
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
