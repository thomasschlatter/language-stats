// Language (locale) queries. A "language" row is a locale: base language +
// country, e.g. de-DE, de-CH, en-US — which is what makes dialects possible.
import db from '../db/index.js';

const COLS = 'id, code, lang, country, name, created_by, tier, glottocode, iso639_3';

// Default returns the SURFACE set (official/regional/de-facto languages + any
// language actually in use — learned/native, or with decks/articles), so the
// 7k+ long tail stays hidden. scope='all' or a search digs into the full catalogue.
export function listLanguages({ scope = 'surface', search = null } = {}) {
  if (search) {
    return db.prepare(
      `SELECT ${COLS} FROM languages WHERE name LIKE ? OR code LIKE ? OR iso639_3 = ?
       ORDER BY (tier = 'official') DESC, (tier = 'regional') DESC, length(name), name LIMIT 80`
    ).all(`%${search}%`, `${search}%`, String(search).toLowerCase());
  }
  if (scope === 'all') return db.prepare(`SELECT ${COLS} FROM languages ORDER BY name`).all();
  return db.prepare(
    `SELECT ${COLS} FROM languages
      WHERE tier IN ('official', 'regional', 'defacto') OR tier IS NULL
         OR EXISTS (SELECT 1 FROM user_languages ul WHERE ul.language_id = languages.id)
         OR EXISTS (SELECT 1 FROM decks d WHERE d.language_id = languages.id)
         OR EXISTS (SELECT 1 FROM articles a WHERE a.language_id = languages.id)
      ORDER BY name`
  ).all();
}

export function getLanguageByCode(code) {
  return db.prepare(`SELECT ${COLS} FROM languages WHERE code = ?`).get(code);
}

export function getLanguageById(id) {
  return db.prepare(`SELECT ${COLS} FROM languages WHERE id = ?`).get(id);
}

export function createLanguage({ code, lang, country, name, createdBy }) {
  const info = db
    .prepare('INSERT INTO languages (code, lang, country, name, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(code, lang, country ?? null, name, createdBy ?? null);
  return getLanguageById(info.lastInsertRowid);
}

// Whether a language has any content (words/cards/articles/tips/messages).
export function languageHasContent(id) {
  const n = (sql) => db.prepare(sql).get(id).n;
  return !!(
    n('SELECT COUNT(*) n FROM words WHERE language_id = ?') ||
    n('SELECT COUNT(*) n FROM articles WHERE language_id = ?') ||
    n('SELECT COUNT(*) n FROM tips WHERE language_id = ?') ||
    n('SELECT COUNT(*) n FROM messages WHERE language_id = ?') ||
    n('SELECT COUNT(*) n FROM cards WHERE language_id = ?')
  );
}

// Delete a language by code. Cascades to its words/cards/tips/messages; frees
// its use as a "written-in" language (those become null). Returns true if removed.
export function deleteLanguage(code) {
  const info = db.prepare('DELETE FROM languages WHERE code = ?').run(code);
  return info.changes > 0;
}
