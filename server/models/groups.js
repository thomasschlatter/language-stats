// Groups = user-made group chats you join via an invite link. Each group has an
// owner, members, and its own message thread.
import { randomBytes } from 'node:crypto';
import db from '../db/index.js';
import { getBotUserId } from './bot.js';

function newInviteCode() {
  // short, url-safe, collision-checked
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(6).toString('base64url');
    if (!db.prepare('SELECT 1 FROM groups WHERE invite_code = ?').get(code)) return code;
  }
  return randomBytes(9).toString('base64url');
}

export function isMember(groupId, userId) {
  return !!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
}

export function createGroup(ownerId, name, isOpen = false) {
  const code = newInviteCode();
  return db.transaction(() => {
    const info = db.prepare('INSERT INTO groups (name, owner_id, invite_code, is_open) VALUES (?, ?, ?, ?)').run(name, ownerId, code, isOpen ? 1 : 0);
    const groupId = info.lastInsertRowid;
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, ownerId);
    // Seed the chat with a welcome message from the Foxy bot.
    db.prepare('INSERT INTO group_messages (group_id, sender_id, body) VALUES (?, ?, ?)').run(
      groupId, getBotUserId(),
      `👋 Welcome to “${name}”! This group was just created. Share the invite link to add friends, and say @foxy anytime to chat with me.`
    );
    return getGroup(groupId, ownerId);
  })();
}

export function getGroup(id, userId) {
  const g = db.prepare(
    `SELECT g.id, g.name, g.owner_id, g.invite_code, g.is_open, g.created_at,
            (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS members
       FROM groups g WHERE g.id = ?`
  ).get(id);
  if (!g) return null;
  g.is_member = isMember(id, userId);
  g.is_owner = g.owner_id === userId;
  if (g.is_member) {
    g.memberList = db.prepare(
      `SELECT u.username, u.avatar, u.avatar_image FROM group_members m JOIN users u ON u.id = m.user_id
        WHERE m.group_id = ? ORDER BY m.joined_at`
    ).all(id);
  }
  return g;
}

export function listMyGroups(userId) {
  return db.prepare(
    `SELECT g.id, g.name, g.owner_id, g.created_at,
            (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS members,
            (SELECT COUNT(*) FROM group_messages gm WHERE gm.group_id = g.id) AS message_count
       FROM groups g
       JOIN group_members me ON me.group_id = g.id AND me.user_id = ?
      ORDER BY g.id DESC`
  ).all(userId);
}

export function joinByCode(userId, code) {
  const g = db.prepare('SELECT id FROM groups WHERE invite_code = ?').get(code);
  if (!g) return null;
  db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(g.id, userId);
  return getGroup(g.id, userId);
}

// Open groups the user hasn't joined yet — discoverable without an invite.
export function listOpenGroups(userId, limit = 40) {
  return db.prepare(
    `SELECT g.id, g.name, g.owner_id, g.created_at,
            (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS members
       FROM groups g
      WHERE g.is_open = 1
        AND NOT EXISTS (SELECT 1 FROM group_members me WHERE me.group_id = g.id AND me.user_id = ?)
      ORDER BY members DESC, g.id DESC LIMIT ?`
  ).all(userId, limit);
}

// Join an OPEN group by id (no invite needed). Returns null if not open.
export function joinOpenGroup(userId, groupId) {
  const g = db.prepare('SELECT id, is_open FROM groups WHERE id = ?').get(groupId);
  if (!g || !g.is_open) return null;
  db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(g.id, userId);
  return getGroup(g.id, userId);
}

export function leaveGroup(userId, groupId) {
  return db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId).changes > 0;
}

const MSG_COLS = `gm.id, gm.body, gm.created_at, gm.body_lang_id,
  u.username AS author, u.avatar AS author_avatar, u.avatar_image AS author_avatar_image,
  (SELECT code FROM languages WHERE id = gm.body_lang_id) AS body_lang`;

export function postGroupMessage({ groupId, senderId, body, bodyLangId }) {
  const info = db.prepare('INSERT INTO group_messages (group_id, sender_id, body, body_lang_id) VALUES (?, ?, ?, ?)')
    .run(groupId, senderId, body, bodyLangId ?? null);
  return db.prepare(`SELECT ${MSG_COLS} FROM group_messages gm JOIN users u ON u.id = gm.sender_id WHERE gm.id = ?`).get(info.lastInsertRowid);
}

export function groupMessages(groupId, since = 0) {
  return db.prepare(
    `SELECT ${MSG_COLS} FROM group_messages gm JOIN users u ON u.id = gm.sender_id
      WHERE gm.group_id = ? AND gm.id > ? ORDER BY gm.id LIMIT 200`
  ).all(groupId, since);
}
