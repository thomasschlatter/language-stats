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
  return db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?').get(id);
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
