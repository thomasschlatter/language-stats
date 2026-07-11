// Card upvote queries.
import db from '../db/index.js';

export function voteCount(articleId) {
  return db.prepare('SELECT COUNT(*) AS n FROM article_votes WHERE article_id = ?').get(articleId).n;
}

export function userVoted(articleId, userId) {
  return !!db
    .prepare('SELECT 1 FROM article_votes WHERE article_id = ? AND user_id = ?')
    .get(articleId, userId);
}

// The set of article ids (from `ids`) the user has upvoted — for list views.
export function votedIds(userId, ids) {
  if (!ids.length) return new Set();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT article_id FROM article_votes WHERE user_id = ? AND article_id IN (${placeholders})`)
    .all(userId, ...ids);
  return new Set(rows.map((r) => r.article_id));
}

// Toggle a user's vote; returns the new state.
export function toggleVote(articleId, userId) {
  if (userVoted(articleId, userId)) {
    db.prepare('DELETE FROM article_votes WHERE article_id = ? AND user_id = ?').run(articleId, userId);
    return { voted: false, votes: voteCount(articleId) };
  }
  db.prepare('INSERT INTO article_votes (article_id, user_id) VALUES (?, ?)').run(articleId, userId);
  return { voted: true, votes: voteCount(articleId) };
}
