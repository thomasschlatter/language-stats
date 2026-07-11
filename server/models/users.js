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
    .prepare('SELECT id, email, username, bio, interests, created_at FROM users WHERE id = ?')
    .get(id);
}

// Returns the full row (incl. password_hash) — for auth checks only.
export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
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

export function updateProfile(userId, { bio, interests }) {
  db.prepare('UPDATE users SET bio = ?, interests = ? WHERE id = ?')
    .run(bio ?? null, interests ?? null, userId);
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

// A public profile: basic fields + languages split by role.
export function profile(user) {
  if (!user) return null;
  const langs = getUserLanguages(user.id);
  return {
    id: user.id,
    username: user.username,
    bio: user.bio || null,
    interests: user.interests ? user.interests.split(',').map((s) => s.trim()).filter(Boolean) : [],
    native: langs.filter((l) => l.role === 'native').map(({ code, name }) => ({ code, name })),
    learning: langs.filter((l) => l.role === 'learning').map(({ code, name }) => ({ code, name })),
    created_at: user.created_at,
  };
}
