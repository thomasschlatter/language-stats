// Phase 1 of the sense-network: seed the dictionary with the official decks'
// corrected translations. For every deck card (front word -> back gloss) we
// ensure a `words` row for the front word and add the gloss as a `word_definitions`
// sense (source='seed', accepted=1). Idempotent: never duplicates a word or an
// identical sense. Safe to re-run. See memory/sense-network.md.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db/index.js';
import { ensureWord } from '../models/words.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deckDir = join(__dirname, '..', 'seed-data', 'official-decks');

const pickLang = db.prepare('SELECT id, code FROM languages WHERE lang = ? ORDER BY (code = ?) DESC, id LIMIT 1');
const defsFor = db.prepare('SELECT text FROM word_definitions WHERE word_id = ?');
const insDef = db.prepare("INSERT INTO word_definitions (word_id, text, source, accepted) VALUES (?, ?, 'seed', 1)");

// Normalise a gloss so "woman; wife; Mrs" == "woman; Mrs; wife." — order and
// punctuation don't make a distinct sense.
const norm = (s) => s.toLowerCase().split(/[;,/]+/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).sort().join('|');
const keyCache = new Map(); // word_id -> Set(normalised keys already present)
function keysFor(wid) {
  let set = keyCache.get(wid);
  if (!set) { set = new Set(defsFor.all(wid).map((r) => norm(r.text))); keyCache.set(wid, set); }
  return set;
}

const files = readdirSync(deckDir).filter((f) => /^[a-z]{2,3}(-[a-z0-9]+)?\.json$/.test(f));
let words = 0; let senses = 0; let cards = 0;

for (const f of files) {
  const base = f.replace('.json', '').split('-')[0];
  const lang = pickLang.get(base, `${base}-${base.toUpperCase()}`);
  if (!lang) { console.warn('no language for', f); continue; }
  const decks = JSON.parse(readFileSync(join(deckDir, f), 'utf8'));
  const seenWords = new Set(); // per-file de-dup of ensureWord work
  const run = db.transaction(() => {
    for (const d of decks) {
      for (const c of d.cards || []) {
        cards += 1;
        const front = (c.front || '').trim();
        const back = (c.back || '').trim();
        if (!front || !back) continue;
        const wid = ensureWord(lang.id, front);
        if (!seenWords.has(wid)) { seenWords.add(wid); words += 1; }
        const keys = keysFor(wid);
        const k = norm(back);
        if (k && !keys.has(k)) { insDef.run(wid, back); keys.add(k); senses += 1; }
      }
    }
  });
  run();
  console.log(`${f}: processed`);
}
console.log(`\nSeeded: ${words} words touched, ${senses} new senses, from ${cards} cards.`);
