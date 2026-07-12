// Block + report queries.
import db from './../db/index.js';

export function isBlocked(blockerId, blockedId) {
  return !!db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(blockerId, blockedId);
}

// True if either user has blocked the other (used to cut off DMs).
export function blockedBetween(a, b) {
  return !!db
    .prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)')
    .get(a, b, b, a);
}

export function toggleBlock(blockerId, blockedId) {
  if (isBlocked(blockerId, blockedId)) {
    db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(blockerId, blockedId);
    return { blocked: false };
  }
  db.prepare('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(blockerId, blockedId);
  // Blocking implies unfollowing in both directions.
  db.prepare('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)')
    .run(blockerId, blockedId, blockedId, blockerId);
  return { blocked: true };
}

// The set of user ids this user has blocked (for filtering lists).
export function blockedIds(userId) {
  const rows = db.prepare('SELECT blocked_id FROM blocks WHERE blocker_id = ?').all(userId);
  return new Set(rows.map((r) => r.blocked_id));
}

export function addReport({ reporterId, targetType, targetId, reason }) {
  db.prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)')
    .run(reporterId, targetType, targetId, reason ?? null);
}
