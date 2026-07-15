// Merge duplicate senses on the same word (e.g. two identical "but" rows). For each
// word, group definitions by normalized text; within a group keep the one with the
// most card links (ties → lowest id), repoint cards.definition_id and votes to it,
// and delete the rest. Idempotent.
//
//   DATA_DIR=/var/data/language-stats node server/scripts/dedupe-senses.mjs
import db from '../db/index.js';

const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.]+$/, '');
const words = db.prepare('SELECT DISTINCT word_id FROM word_definitions').all();
const defsFor = db.prepare('SELECT id, text FROM word_definitions WHERE word_id = ?');
const linkCount = db.prepare('SELECT COUNT(*) c FROM cards WHERE definition_id = ?');
const repointCards = db.prepare('UPDATE cards SET definition_id = ? WHERE definition_id = ?');
const moveVotes = db.prepare('UPDATE OR IGNORE definition_votes SET definition_id = ? WHERE definition_id = ?');
const delVotes = db.prepare('DELETE FROM definition_votes WHERE definition_id = ?');
const delDef = db.prepare('DELETE FROM word_definitions WHERE id = ?');

let merged = 0;
db.transaction(() => {
  for (const { word_id } of words) {
    const defs = defsFor.all(word_id);
    const groups = new Map();
    for (const d of defs) {
      const k = norm(d.text);
      if (!k) continue;
      (groups.get(k) || groups.set(k, []).get(k)).push(d);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      // Keep the most-linked (ties: lowest id).
      group.sort((a, b) => (linkCount.get(b.id).c - linkCount.get(a.id).c) || (a.id - b.id));
      const keep = group[0];
      for (const dup of group.slice(1)) {
        repointCards.run(keep.id, dup.id);
        moveVotes.run(keep.id, dup.id);
        delVotes.run(dup.id);
        delDef.run(dup.id);
        merged += 1;
      }
    }
  }
})();
console.log(`deduped ${merged} duplicate senses`);
