// Import Princeton/Open English WordNet senses for English words already in the
// dictionary — gives English words multiple real senses so the link-count
// ranking has something to rank. Point WORDNET_DIR at a WNDB `dict/` folder
// (data.noun, data.verb, data.adj, data.adv). Idempotent, deduped, capped per word.
// WordNet is licensed for reuse; senses are tagged source='wordnet' for attribution.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import db from '../db/index.js';

const DIR = process.env.WORDNET_DIR;
if (!DIR) { console.error('Set WORDNET_DIR to a WordNet dict/ folder.'); process.exit(1); }
const CAP = 8; // senses per word

const norm = (s) => s.toLowerCase().split(/[;,/]+/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).sort().join('|');

// lemma(lowercased) -> ordered list of gloss definitions
const map = new Map();
function parseDataFile(name) {
  let raw;
  try { raw = readFileSync(join(DIR, name), 'utf8'); } catch { return; }
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(' ')) continue; // skip the license header (space-indented)
    const bar = line.indexOf(' | ');
    if (bar < 0) continue;
    const left = line.slice(0, bar).split(' ');
    const gloss = line.slice(bar + 3);
    const wcnt = parseInt(left[3], 16);
    if (!Number.isFinite(wcnt)) continue;
    // definition = gloss text before the first quoted example
    let def = gloss.replace(/;?\s*"[^"]*"/g, '').replace(/;\s*$/, '').trim();
    if (!def || def.length > 80) continue; // keep senses concise
    for (let i = 0; i < wcnt; i++) {
      const lemma = (left[4 + i * 2] || '').replace(/_/g, ' ').toLowerCase();
      if (!lemma || lemma.includes('(')) continue;
      if (!map.has(lemma)) map.set(lemma, []);
      const arr = map.get(lemma);
      if (!arr.includes(def)) arr.push(def);
    }
  }
}
['data.noun', 'data.verb', 'data.adj', 'data.adv'].forEach(parseDataFile);
console.log(`WordNet parsed: ${map.size} lemmas.`);

// English words already in the graph
const enWords = db.prepare(
  "SELECT w.id, w.text FROM words w JOIN languages l ON l.id = w.language_id WHERE l.lang = 'en'"
).all();
const defsFor = db.prepare('SELECT text FROM word_definitions WHERE word_id = ?');
const insDef = db.prepare("INSERT INTO word_definitions (word_id, text, source, accepted) VALUES (?, ?, 'wordnet', 0)");

let words = 0; let senses = 0;
const tx = db.transaction(() => {
  for (const w of enWords) {
    const glosses = map.get(w.text.toLowerCase());
    if (!glosses || !glosses.length) continue;
    const keys = new Set(defsFor.all(w.id).map((r) => norm(r.text)));
    let added = 0;
    for (const g of glosses) {
      if (added >= CAP) break;
      const k = norm(g);
      if (k && !keys.has(k)) { insDef.run(w.id, g); keys.add(k); senses += 1; added += 1; }
    }
    if (added) words += 1;
  }
});
tx();
console.log(`WordNet import: ${senses} senses added to ${words} English words (of ${enWords.length}).`);
