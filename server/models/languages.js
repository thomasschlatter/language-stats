// Language queries.
import db from '../db/index.js';

export function listLanguages() {
  return db.prepare('SELECT id, code, name FROM languages ORDER BY name').all();
}

export function getLanguageByCode(code) {
  return db.prepare('SELECT id, code, name FROM languages WHERE code = ?').get(code);
}

export function getLanguageById(id) {
  return db.prepare('SELECT id, code, name FROM languages WHERE id = ?').get(id);
}

export function createLanguage({ code, name }) {
  const info = db
    .prepare('INSERT INTO languages (code, name) VALUES (?, ?)')
    .run(code, name);
  return getLanguageById(info.lastInsertRowid);
}
