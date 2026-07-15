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

// Fetch a single word entry by language + text (case-SENSITIVE — "US" ≠ "us").
// Sentence-initial capitalisation is handled client-side (see render.js), which
// knows a word's position; the server keeps exact matching so a capitalised noun
// is never conflated with a lowercase homograph.
export function getEntry(languageId, text) {
  return db
    .prepare(
      `SELECT w.id, w.language_id, w.text, w.meaning, w.notes, w.scraped_at,
              l.code AS language_code, l.name AS language_name
       FROM words w
       JOIN languages l ON l.id = w.language_id
       WHERE w.language_id = ? AND w.text = ?`
    )
    .get(languageId, text);
}

// The lemma (base form) a given word points at, if any — e.g. "links" -> "link".
// Returns the lemma word row (id, text, language_code) or null.
export function getLemma(wordId) {
  return db
    .prepare(
      `SELECT lem.id, lem.text, l.code AS language_code, l.name AS language_name
       FROM words w
       JOIN words lem ON lem.id = w.lemma_id
       JOIN languages l ON l.id = lem.language_id
       WHERE w.id = ?`
    )
    .get(wordId);
}

// Point an inflected form at its lemma (both in the same language). No-op if it
// would create a self-loop.
export function setLemma(wordId, lemmaWordId) {
  if (!wordId || !lemmaWordId || wordId === lemmaWordId) return;
  db.prepare('UPDATE words SET lemma_id = ? WHERE id = ?').run(lemmaWordId, wordId);
}

// Get the word's id, creating a bare entry if it doesn't exist yet.
export function ensureWord(languageId, text) {
  const existing = db.prepare('SELECT id FROM words WHERE language_id = ? AND text = ?').get(languageId, text);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO words (language_id, text) VALUES (?, ?)').run(languageId, text).lastInsertRowid;
}

// Search dictionary words across all languages (prefix match), with a snippet
// of the top definition for each.
export function searchWords(q, limit = 30) {
  return db
    .prepare(
      `SELECT w.id, w.text, l.code AS language_code, l.name AS language_name,
              (SELECT wd.text FROM word_definitions wd WHERE wd.word_id = w.id
               ORDER BY wd.accepted DESC, wd.id LIMIT 1) AS def
       FROM words w
       JOIN languages l ON l.id = w.language_id
       WHERE w.text LIKE ?
       ORDER BY (w.text = ?) DESC, length(w.text), w.text
       LIMIT ?`
    )
    .all(`${q}%`, q, limit);
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

export function markWordScraped(id) {
  db.prepare("UPDATE words SET scraped_at = datetime('now') WHERE id = ?").run(id);
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
