// Phase 2 backfill: link each official card to its matching seed sense, so the
// card's meaning comes from the live, votable dictionary sense. Matches on the
// front word + a normalized gloss key. Idempotent (only fills NULL definition_id).
import db from '../db/index.js';

const norm = (s) => s.toLowerCase().split(/[;,/]+/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).sort().join('|');

const cards = db.prepare(`
  SELECT c.id, c.front, c.back, d.language_id
    FROM cards c JOIN decks d ON d.id = c.deck_id
   WHERE d.is_official = 1 AND c.definition_id IS NULL
`).all();

const findWord = db.prepare('SELECT id FROM words WHERE language_id = ? AND text = ?');
const defsFor = db.prepare('SELECT id, text FROM word_definitions WHERE word_id = ?');
const setDef = db.prepare('UPDATE cards SET definition_id = ? WHERE id = ?');

let linked = 0; let noWord = 0; let noSense = 0;
const tx = db.transaction(() => {
  for (const c of cards) {
    const w = findWord.get(c.language_id, c.front);
    if (!w) { noWord += 1; continue; }
    const k = norm(c.back || '');
    const match = defsFor.all(w.id).find((d) => norm(d.text) === k);
    if (!match) { noSense += 1; continue; }
    setDef.run(match.id, c.id);
    linked += 1;
  }
});
tx();
console.log(`Backfill: ${linked} cards linked, ${noWord} missing word, ${noSense} no matching sense (of ${cards.length}).`);
