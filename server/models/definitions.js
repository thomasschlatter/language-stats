// Word-definition queries: multiple candidate definitions per word, upvotable,
// with an "accepted" flag (a word may have several accepted senses).
import db from './../db/index.js';

const ACCEPT_VOTES = 3; // user definitions become "accepted" at this many upvotes

export function addDefinition({ wordId, text, source, createdBy, accepted = false }) {
  // A gloss like "hour; time; o'clock" is several senses — split on ';' so each is
  // its own node (',' usually joins synonyms within a sense, so keep those whole).
  const parts = String(text).split(';').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) parts.push(String(text).trim());
  const existing = new Set(
    db.prepare('SELECT text FROM word_definitions WHERE word_id = ?').all(wordId)
      .map((r) => r.text.toLowerCase().trim())
  );
  const ins = db.prepare('INSERT INTO word_definitions (word_id, text, source, created_by, accepted) VALUES (?, ?, ?, ?, ?)');
  let firstId = null;
  for (const p of parts) {
    const key = p.toLowerCase().trim();
    if (existing.has(key)) continue;
    const info = ins.run(wordId, p, source ?? null, createdBy ?? null, accepted ? 1 : 0);
    if (firstId === null) firstId = info.lastInsertRowid;
    existing.add(key);
  }
  if (firstId === null) {
    // Every part already existed — return the first part's existing id.
    const r = db.prepare('SELECT id FROM word_definitions WHERE word_id = ? AND lower(trim(text)) = ? LIMIT 1')
      .get(wordId, parts[0].toLowerCase().trim());
    firstId = r?.id ?? null;
  }
  return firstId;
}

export function clearWiktionaryDefinitions(wordId) {
  db.prepare("DELETE FROM word_definitions WHERE word_id = ? AND source = 'wiktionary'").run(wordId);
}

export function hasDefinitions(wordId) {
  return db.prepare('SELECT COUNT(*) AS n FROM word_definitions WHERE word_id = ?').get(wordId).n > 0;
}

export function getDefinition(id) {
  return db.prepare('SELECT * FROM word_definitions WHERE id = ?').get(id);
}

// Definitions for a word, most-endorsed first, with vote counts (+ the viewer's
// vote state when userId is given).
export function listDefinitions(wordId, userId) {
  return db
    .prepare(
      `SELECT d.id, d.text, d.source, d.accepted, d.created_at,
              u.username AS author,
              (SELECT COUNT(*) FROM definition_votes v WHERE v.definition_id = d.id) AS votes,
              (SELECT COUNT(*) FROM cards c WHERE c.definition_id = d.id) AS links,
              ${userId ? '(SELECT COUNT(*) FROM definition_votes v WHERE v.definition_id = d.id AND v.user_id = @uid)' : '0'} AS voted
       FROM word_definitions d
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.word_id = @wid
       -- Sense importance = how many string→sense links point at it (PageRank-ish),
       -- so common senses rank first; votes/recency break ties.
       ORDER BY links DESC, d.accepted DESC, votes DESC, d.created_at ASC`
    )
    .all({ wid: wordId, uid: userId || 0 })
    .map((r) => ({ ...r, voted: !!r.voted, accepted: !!r.accepted }));
}

export function toggleDefinitionVote(definitionId, userId) {
  const voted = db.prepare('SELECT 1 FROM definition_votes WHERE definition_id = ? AND user_id = ?').get(definitionId, userId);
  if (voted) {
    db.prepare('DELETE FROM definition_votes WHERE definition_id = ? AND user_id = ?').run(definitionId, userId);
  } else {
    db.prepare('INSERT OR IGNORE INTO definition_votes (definition_id, user_id) VALUES (?, ?)').run(definitionId, userId);
  }
  const votes = db.prepare('SELECT COUNT(*) AS n FROM definition_votes WHERE definition_id = ?').get(definitionId).n;
  // Auto-accept once a community definition clears the threshold.
  if (votes >= ACCEPT_VOTES) db.prepare('UPDATE word_definitions SET accepted = 1 WHERE id = ?').run(definitionId);
  return { voted: !voted, votes };
}
