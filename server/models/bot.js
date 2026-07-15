// Shared chat bot user ("Foxy"). Owns the welcome messages and @foxy replies
// that appear in group chats and language chats. Never logs in (unusable pw).
import db from '../db/index.js';

let cachedId = null;
export const BOT_NAME = 'Foxy';

export function getBotUserId() {
  if (cachedId) return cachedId;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('foxy@groupifier.com');
  if (existing) { cachedId = existing.id; return cachedId; }
  const info = db.prepare('INSERT INTO users (email, username, password_hash, bio) VALUES (?, ?, ?, ?)')
    .run('foxy@groupifier.com', BOT_NAME, '!', 'Friendly language fox — say @foxy in any chat to talk to me.');
  cachedId = info.lastInsertRowid;
  return cachedId;
}

export const mentionsFoxy = (text) => /(^|\s)@foxy\b/i.test(String(text || ''));
