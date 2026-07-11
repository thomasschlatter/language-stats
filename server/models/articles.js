// Article ("card") queries.
import db from '../db/index.js';

const LIST_COLS = `a.id, a.slug, a.title, a.summary, a.is_official, a.created_at,
                   bl.code AS body_lang, u.username AS author,
                   (SELECT COUNT(*) FROM article_votes av WHERE av.article_id = a.id) AS votes`;

// List cards for a language. If `nativeBase` (a base language like 'en' or
// 'es') is given, only cards written in that language are returned — so cards
// are relative to the learner's native tongue. Cards with no body language set
// are always shown.
export function listArticles(languageId, nativeBase) {
  if (nativeBase) {
    return db
      .prepare(
        `SELECT ${LIST_COLS}
         FROM articles a
         LEFT JOIN languages bl ON bl.id = a.body_lang_id
         LEFT JOIN users u ON u.id = a.author_id
         WHERE a.language_id = ? AND (bl.lang = ? OR a.body_lang_id IS NULL)
         ORDER BY a.is_official DESC, votes DESC, a.created_at DESC`
      )
      .all(languageId, nativeBase);
  }
  return db
    .prepare(
      `SELECT ${LIST_COLS}
       FROM articles a
       LEFT JOIN languages bl ON bl.id = a.body_lang_id
       LEFT JOIN users u ON u.id = a.author_id
       WHERE a.language_id = ?
       ORDER BY a.is_official DESC, votes DESC, a.created_at DESC`
    )
    .all(languageId);
}

export function getArticle(id) {
  return db
    .prepare(
      `SELECT a.id, a.language_id, a.slug, a.title, a.summary, a.body,
              a.is_official, a.created_at,
              l.code AS language_code, l.name AS language_name,
              bl.code AS body_lang, u.username AS author,
              (SELECT COUNT(*) FROM article_votes av WHERE av.article_id = a.id) AS votes
       FROM articles a
       JOIN languages l ON l.id = a.language_id
       LEFT JOIN languages bl ON bl.id = a.body_lang_id
       LEFT JOIN users u ON u.id = a.author_id
       WHERE a.id = ?`
    )
    .get(id);
}

export function findArticleBySlug(languageId, slug) {
  return db
    .prepare('SELECT id FROM articles WHERE language_id = ? AND slug = ?')
    .get(languageId, slug);
}

export function createArticle({ languageId, bodyLangId, slug, title, summary, body, authorId, isOfficial }) {
  const info = db
    .prepare(
      `INSERT INTO articles (language_id, body_lang_id, slug, title, summary, body, author_id, is_official)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(languageId, bodyLangId ?? null, slug, title, summary ?? null, body, authorId ?? null, isOfficial ? 1 : 0);
  return getArticle(info.lastInsertRowid);
}
