// User queries + password hashing helpers.
import bcrypt from 'bcryptjs';
import db from '../db/index.js';

export function createUser({ email, username, password }) {
  const password_hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)')
    .run(email, username, password_hash);
  return getUserById(info.lastInsertRowid);
}

export function getUserById(id) {
  return db
    .prepare('SELECT id, email, username, bio, interests, origin, location, avatar, created_at FROM users WHERE id = ?')
    .get(id);
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

// Replace a user's languages for a given role ('native' | 'learning').
export function setUserLanguages(userId, role, languageIds) {
  const del = db.prepare('DELETE FROM user_languages WHERE user_id = ? AND role = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO user_languages (user_id, language_id, role) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    del.run(userId, role);
    for (const lid of languageIds) ins.run(userId, lid, role);
  });
  tx();
}

export function getUserLanguages(userId) {
  return db
    .prepare(
      `SELECT ul.role, l.code, l.name
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
  return {
    id: user.id,
    username: user.username,
    bio: user.bio || null,
    interests: user.interests ? user.interests.split(',').map((s) => s.trim()).filter(Boolean) : [],
    origin: user.origin || null,
    location: user.location || null,
    avatar,
    native: langs.filter((l) => l.role === 'native').map(({ code, name }) => ({ code, name })),
    learning: langs.filter((l) => l.role === 'learning').map(({ code, name }) => ({ code, name })),
    created_at: user.created_at,
  };
}
