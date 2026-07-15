// Split compound definitions like "hour; time; o'clock" into separate senses, so
// each meaning is its own votable, linkable node in the sense network. The FIRST
// part stays on the original row (keeping its id, votes and card links); the rest
// become new sibling senses (deduped against what the word already has). Only ';'
// is treated as a sense separator — ',' usually joins synonyms within one sense.
// Idempotent: after a run no definition contains ';', so re-running is a no-op.
//
//   DATA_DIR=/var/data/language-stats node server/scripts/split-compound-senses.mjs
import db from '../db/index.js';

const norm = (s) => s.toLowerCase().trim().replace(/\.+$/, '');
const compound = db.prepare("SELECT id, word_id, text, source, accepted, created_by FROM word_definitions WHERE text LIKE '%;%'").all();
const siblings = db.prepare('SELECT id, text FROM word_definitions WHERE word_id = ?');
const updateText = db.prepare('UPDATE word_definitions SET text = ? WHERE id = ?');
const insDef = db.prepare('INSERT INTO word_definitions (word_id, text, source, created_by, accepted) VALUES (?, ?, ?, ?, ?)');

let splitCount = 0; let added = 0;
db.transaction(() => {
  for (const d of compound) {
    const parts = d.text.split(';').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) { if (parts[0] && parts[0] !== d.text) updateText.run(parts[0], d.id); continue; }
    // Senses this word already has, excluding the row we're splitting.
    const keys = new Set(siblings.all(d.word_id).filter((r) => r.id !== d.id).map((r) => norm(r.text)));
    updateText.run(parts[0], d.id); // primary keeps id/votes/links
    keys.add(norm(parts[0]));
    for (const p of parts.slice(1)) {
      const k = norm(p);
      if (!k || keys.has(k)) continue;
      insDef.run(d.word_id, p, d.source, d.created_by, d.accepted);
      keys.add(k);
      added += 1;
    }
    splitCount += 1;
  }
})();
console.log(`split ${splitCount} compound definitions, added ${added} new senses`);
