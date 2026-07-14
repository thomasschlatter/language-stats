// User queries + password hashing helpers.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import db from '../db/index.js';

export function createUser({ email, username, password }) {
  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)')
    .run(email, username, password_hash);
  return getUserById(info.lastInsertRowid);
}

// Find a user by their linked LINE account id.
export function getUserByLineId(lineId) {
  return db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(lineId);
}

// Link a LINE account to an existing user (used when the verified LINE email
// matches an existing account). Returns the updated user.
export function linkLineId(userId, lineId) {
  db.prepare('UPDATE users SET line_user_id = ? WHERE id = ?').run(lineId, userId);
  return getUserById(userId);
}

// Create a user linked to a LINE account. They sign in via LINE, so the password
// is a throwaway random value. Username/email are made unique — if the LINE
// email is already taken we fall back to a synthesized address (so the INSERT
// never fails on the UNIQUE(email) constraint).
export function createLineUser({ lineId, displayName, email }) {
  const password_hash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
  let base = String(displayName || 'user').normalize('NFKD').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 24);
  if (base.length < 2) base = 'user';
  let username = base;
  while (getUserByUsername(username)) username = `${base}_${crypto.randomBytes(2).toString('hex')}`.slice(0, 30);
  const mail = (email && !getUserByEmail(email)) ? email : `line_${lineId}@line.local`;
  const info = db
    .prepare('INSERT INTO users (email, username, password_hash, line_user_id) VALUES (?, ?, ?, ?)')
    .run(mail, username, password_hash, lineId);
  return getUserById(info.lastInsertRowid);
}

// Find an existing user by email, or create a passwordless one (magic-link
// signup). The password is a throwaway random value; the username is derived
// from the email and made unique.
export function findOrCreateByEmail(email) {
  const existing = getUserByEmail(email);
  if (existing) return { user: getUserById(existing.id), isNew: false };
  const password_hash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
  let base = String(email.split('@')[0] || 'user').normalize('NFKD').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 24);
  if (base.length < 2) base = 'user';
  let username = base;
  while (getUserByUsername(username)) username = `${base}_${crypto.randomBytes(2).toString('hex')}`.slice(0, 30);
  const info = db
    .prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)')
    .run(email, username, password_hash);
  return { user: getUserById(info.lastInsertRowid), isNew: true };
}

export function getUserById(id) {
  return db
    .prepare('SELECT id, email, username, bio, interests, origin, location, avatar, avatar_image, created_at FROM users WHERE id = ?')
    .get(id);
}

// Set (or clear, with null) the user's personal photo avatar path.
export function setAvatarImage(userId, path) {
  db.prepare('UPDATE users SET avatar_image = ? WHERE id = ?').run(path ?? null, userId);
}

// Save a user's character (avatar layer indices) as JSON.
export function setAvatar(userId, avatar) {
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(
    avatar ? JSON.stringify(avatar) : null,
    userId
  );
}

// Returns the full row (incl. password_hash) — for auth checks only.
export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

// Verify the current password, then set a new one. Returns { ok, error? }.
export function changePassword(userId, currentPassword, newPassword) {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!row) return { ok: false, error: 'user not found' };
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    return { ok: false, error: 'current password is incorrect' };
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), userId);
  return { ok: true };
}

// Strip sensitive fields before sending a user to the client.
export function publicUser(user) {
  if (!user) return null;
  const { id, email, username, created_at } = user;
  return { id, email, username, created_at };
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
}

export function updateProfile(userId, { bio, interests, origin, location }) {
  db.prepare('UPDATE users SET bio = ?, interests = ?, origin = ?, location = ? WHERE id = ?')
    .run(bio ?? null, interests ?? null, origin ?? null, location ?? null, userId);
}

// Self-rated CEFR proficiency. Stored as a1..c2; invalid values are ignored.
export const CEFR_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
export function setLevel(userId, level) {
  if (!CEFR_LEVELS.includes(level)) return;
  db.prepare('UPDATE users SET level = ? WHERE id = ?').run(level, userId);
}

// Set which native language is primary (drives click-to-translate). Stored as a
// code; profile() falls back to the first native if it's no longer a native.
export function setPrimaryNative(userId, code) {
  db.prepare('UPDATE users SET primary_native = ? WHERE id = ?').run(code || null, userId);
}

// Set the CEFR proficiency for a single learning language.
export function setLanguageLevel(userId, languageId, level) {
  if (!CEFR_LEVELS.includes(level)) return;
  db.prepare("UPDATE user_languages SET level = ? WHERE user_id = ? AND language_id = ? AND role = 'learning'")
    .run(level, userId, languageId);
}

// Replace a user's languages for a given role ('native' | 'learning'),
// preserving each language's existing proficiency level across edits.
export function setUserLanguages(userId, role, languageIds) {
  const prev = db.prepare('SELECT language_id, level FROM user_languages WHERE user_id = ? AND role = ?').all(userId, role);
  const levelOf = new Map(prev.map((r) => [r.language_id, r.level || 'a1']));
  const del = db.prepare('DELETE FROM user_languages WHERE user_id = ? AND role = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO user_languages (user_id, language_id, role, level) VALUES (?, ?, ?, ?)');
  const tx = db.transaction(() => {
    del.run(userId, role);
    for (const lid of languageIds) ins.run(userId, lid, role, levelOf.get(lid) || 'a1');
  });
  tx();
}

export function getUserLanguages(userId) {
  return db
    .prepare(
      `SELECT ul.role, ul.level, l.code, l.name
       FROM user_languages ul JOIN languages l ON l.id = ul.language_id
       WHERE ul.user_id = ?
       ORDER BY ul.role, l.name`
    )
    .all(userId);
}

// Browse community members, optionally filtered by a native language
// (`speaksId`), a learning language (`learningId`), and a username query.
// Excludes `excludeUserId` (the viewer). Returns full profiles.
export function listCommunity({ excludeUserId, speaksId, learningId, q, limit = 24, offset = 0 }) {
  const joins = [];
  const where = [];
  const params = [];

  if (speaksId) {
    joins.push('JOIN user_languages nl ON nl.user_id = u.id AND nl.role = \'native\' AND nl.language_id = ?');
    params.push(speaksId);
  }
  if (learningId) {
    joins.push('JOIN user_languages ll ON ll.user_id = u.id AND ll.role = \'learning\' AND ll.language_id = ?');
    params.push(learningId);
  }
  if (excludeUserId) { where.push('u.id != ?'); params.push(excludeUserId); }
  if (q) { where.push('u.username LIKE ?'); params.push(`%${q}%`); }

  const sql =
    `SELECT DISTINCT u.* FROM users u
     ${joins.join('\n')}
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(...params).map(profile);
}

// A public profile: basic fields + languages split by role.
export function profile(user) {
  if (!user) return null;
  const langs = getUserLanguages(user.id);
  let avatar = null;
  try { avatar = user.avatar ? JSON.parse(user.avatar) : null; } catch { avatar = null; }
  const nativeCodes = langs.filter((l) => l.role === 'native').map((l) => l.code);
  const primaryNative = (user.primary_native && nativeCodes.includes(user.primary_native))
    ? user.primary_native
    : (nativeCodes[0] || null);
  return {
    id: user.id,
    username: user.username,
    bio: user.bio || null,
    interests: user.interests ? user.interests.split(',').map((s) => s.trim()).filter(Boolean) : [],
    origin: user.origin || null,
    location: user.location || null,
    avatar,
    avatar_image: user.avatar_image || null,
    level: user.level || 'a1', // legacy global; per-language levels are on `learning`
    native: langs.filter((l) => l.role === 'native').map(({ code, name }) => ({ code, name })),
    primaryNative,
    learning: langs.filter((l) => l.role === 'learning').map(({ code, name, level }) => ({ code, name, level: level || 'a1' })),
    created_at: user.created_at,
  };
}
