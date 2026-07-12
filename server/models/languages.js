// Language (locale) queries. A "language" row is a locale: base language +
// country, e.g. de-DE, de-CH, en-US — which is what makes dialects possible.
import db from '../db/index.js';

const COLS = 'id, code, lang, country, name';

export function listLanguages() {
  return db.prepare(`SELECT ${COLS} FROM languages ORDER BY name`).all();
}

export function getLanguageByCode(code) {
  return db.prepare(`SELECT ${COLS} FROM languages WHERE code = ?`).get(code);
}

export function getLanguageById(id) {
  return db.prepare(`SELECT ${COLS} FROM languages WHERE id = ?`).get(id);
}

export function createLanguage({ code, lang, country, name }) {
  const info = db
    .prepare('INSERT INTO languages (code, lang, country, name) VALUES (?, ?, ?, ?)')
    .run(code, lang, country ?? null, name);
  return getLanguageById(info.lastInsertRowid);
}

// Delete a language by code. Cascades to its words/cards/tips/messages; frees
// its use as a "written-in" language (those become null). Returns true if removed.
export function deleteLanguage(code) {
  const info = db.prepare('DELETE FROM languages WHERE code = ?').run(code);
  return info.changes > 0;
}
