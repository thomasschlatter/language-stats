// Import Concepticon concept definitions as senses for matching English words.
// Concepticon (CC-BY-SA) is a catalogue of ~4k cross-linguistic concept sets;
// each has a GLOSS (concept label) + DEFINITION. We attach the definition to the
// English word its gloss names, tagged source='concepticon' for attribution.
// Point CONCEPTICON_TSV at concepticondata/concepticon.tsv. Idempotent, deduped.
import { readFileSync } from 'node:fs';
import db from '../db/index.js';

const TSV = process.env.CONCEPTICON_TSV;
if (!TSV) { console.error('Set CONCEPTICON_TSV to concepticon.tsv.'); process.exit(1); }

const norm = (s) => s.toLowerCase().split(/[;,/]+/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).sort().join('|');

// GLOSS -> a single English lemma, or null (skip multi-word/opaque glosses).
function lemmaOf(gloss) {
  let g = gloss.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  g = g.replace(/^(to|the|a|an)\s+/, '');
  if (!/^[a-z][a-z'-]*$/.test(g)) return null; // single word only
  return g;
}

const rows = readFileSync(TSV, 'utf8').split('\n');
const head = rows[0].split('\t');
const gi = head.indexOf('GLOSS'); const di = head.indexOf('DEFINITION'); const ri = head.indexOf('REPLACEMENT_ID');

// lemma -> Set(definition)
const map = new Map();
for (let i = 1; i < rows.length; i++) {
  const f = rows[i].split('\t');
  if (!f[gi]) continue;
  if (ri >= 0 && f[ri]) continue; // skip replaced/deprecated concept sets
  const lemma = lemmaOf(f[gi]);
  const def = (f[di] || '').trim();
  if (!lemma || !def || def.length > 90) continue;
  if (!map.has(lemma)) map.set(lemma, new Set());
  map.get(lemma).add(def);
}
console.log(`Concepticon: ${map.size} single-word concept lemmas.`);

const enWords = db.prepare("SELECT w.id, w.text FROM words w JOIN languages l ON l.id = w.language_id WHERE l.lang = 'en'").all();
const defsFor = db.prepare('SELECT text FROM word_definitions WHERE word_id = ?');
const insDef = db.prepare("INSERT INTO word_definitions (word_id, text, source, accepted) VALUES (?, ?, 'concepticon', 0)");

// CONCEPTICON_REFRESH=1 → clean re-import: drop existing concepticon senses that
// nothing links to, so an updated release replaces stale defs (and removes ones
// no longer in the source) without touching senses a card actually points at.
if (process.env.CONCEPTICON_REFRESH === '1') {
  const del = db.prepare(
    "DELETE FROM word_definitions WHERE source = 'concepticon' AND id NOT IN (SELECT definition_id FROM cards WHERE definition_id IS NOT NULL)"
  ).run();
  console.log(`Refresh: cleared ${del.changes} unreferenced concepticon senses.`);
}

let words = 0; let senses = 0;
db.transaction(() => {
  for (const w of enWords) {
    const defs = map.get(w.text.toLowerCase());
    if (!defs) continue;
    const keys = new Set(defsFor.all(w.id).map((r) => norm(r.text)));
    let added = 0;
    for (const def of defs) {
      const k = norm(def);
      if (k && !keys.has(k)) { insDef.run(w.id, def); keys.add(k); senses += 1; added += 1; }
    }
    if (added) words += 1;
  }
})();
console.log(`Concepticon import: ${senses} senses added to ${words} English words.`);
