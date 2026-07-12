// Word (node) + link (edge) queries — the graph dictionary.
import db from '../db/index.js';

export function listWords(languageId, search) {
  if (search) {
    return db
      .prepare(
        `SELECT id, language_id, text, meaning
         FROM words
         WHERE language_id = ? AND text LIKE ?
         ORDER BY text
         LIMIT 500`
      )
      .all(languageId, `%${search}%`);
  }
  return db
    .prepare(
      `SELECT id, language_id, text, meaning
       FROM words
       WHERE language_id = ?
       ORDER BY text
       LIMIT 500`
    )
    .all(languageId);
}

export function getWordById(id) {
  return db
    .prepare(
      `SELECT w.id, w.language_id, w.text, w.meaning, w.notes, w.created_at,
              l.code AS language_code, l.name AS language_name
       FROM words w
       JOIN languages l ON l.id = w.language_id
       WHERE w.id = ?`
    )
    .get(id);
}

export function findWord(languageId, text) {
  return db
    .prepare('SELECT * FROM words WHERE language_id = ? AND text = ?')
    .get(languageId, text);
}

// Fetch a single word entry by language + text (case-insensitive).
export function getEntry(languageId, text) {
  return db
    .prepare(
      `SELECT w.id, w.language_id, w.text, w.meaning, w.notes,
              l.code AS language_code, l.name AS language_name
       FROM words w
       JOIN languages l ON l.id = w.language_id
       WHERE w.language_id = ? AND w.text = ? COLLATE NOCASE`
    )
    .get(languageId, text);
}

// Look a word up by its TEXT across every language (case-insensitive).
// The same spelling can exist in several languages, so this returns a list.
export function lookupByText(text) {
  return db
    .prepare(
      `SELECT w.id, w.language_id, w.text, w.meaning, w.notes,
              l.code AS language_code, l.name AS language_name
       FROM words w
       JOIN languages l ON l.id = w.language_id
       WHERE w.text = ? COLLATE NOCASE
       ORDER BY l.name`
    )
    .all(text);
}

export function createWord({ languageId, text, meaning, notes, userId }) {
  const info = db
    .prepare(
      `INSERT INTO words (language_id, text, meaning, notes, created_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(languageId, text, meaning ?? null, notes ?? null, userId ?? null);
  return getWordById(info.lastInsertRowid);
}

// Insert or refresh a word's definition (used by the Wiktionary scraper).
export function upsertScrapedWord({ languageId, text, meaning }) {
  const existing = db.prepare('SELECT id FROM words WHERE language_id = ? AND text = ?').get(languageId, text);
  if (existing) {
    db.prepare("UPDATE words SET meaning = ?, scraped_at = datetime('now') WHERE id = ?").run(meaning, existing.id);
    return existing.id;
  }
  const info = db
    .prepare("INSERT INTO words (language_id, text, meaning, scraped_at) VALUES (?, ?, ?, datetime('now'))")
    .run(languageId, text, meaning);
  return info.lastInsertRowid;
}

export function updateWord(id, { meaning, notes }) {
  db.prepare('UPDATE words SET meaning = ?, notes = ? WHERE id = ?').run(
    meaning ?? null,
    notes ?? null,
    id
  );
  return getWordById(id);
}

// All words linked to `wordId`, in either direction (edges are bidirectional).
export function getLinkedWords(wordId) {
  return db
    .prepare(
      `SELECT w.id, w.text, w.meaning, l.code AS language_code, l.name AS language_name,
              wl.type
       FROM word_links wl
       JOIN words w
         ON w.id = CASE WHEN wl.source_word_id = @id THEN wl.target_word_id
                        ELSE wl.source_word_id END
       JOIN languages l ON l.id = w.language_id
       WHERE wl.source_word_id = @id OR wl.target_word_id = @id
       ORDER BY l.name, w.text`
    )
    .all({ id: wordId });
}

export function linkExists(a, b, type) {
  return db
    .prepare(
      `SELECT 1 FROM word_links
       WHERE type = ?
         AND ((source_word_id = ? AND target_word_id = ?)
           OR (source_word_id = ? AND target_word_id = ?))`
    )
    .get(type, a, b, b, a);
}

export function createLink({ sourceId, targetId, type = 'translation', userId }) {
  const info = db
    .prepare(
      `INSERT INTO word_links (source_word_id, target_word_id, type, created_by)
       VALUES (?, ?, ?, ?)`
    )
    .run(sourceId, targetId, type, userId ?? null);
  return db.prepare('SELECT * FROM word_links WHERE id = ?').get(info.lastInsertRowid);
}
