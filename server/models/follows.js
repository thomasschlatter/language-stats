// Follow-graph queries.
import db from '../db/index.js';

export function isFollowing(followerId, followingId) {
  return !!db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(followerId, followingId);
}

export function toggleFollow(followerId, followingId) {
  if (isFollowing(followerId, followingId)) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(followerId, followingId);
    return { following: false };
  }
  db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)').run(followerId, followingId);
  return { following: true };
}

export function followerCount(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM follows WHERE following_id = ?').get(userId).n;
}
export function followingCount(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?').get(userId).n;
}

// Which of `ids` the user follows — for list views.
export function followingSet(followerId, ids) {
  if (!ids.length) return new Set();
  const q = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${q})`)
    .all(followerId, ...ids);
  return new Set(rows.map((r) => r.following_id));
}
