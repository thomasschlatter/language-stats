// Stream a Kaikki (English-Wiktionary, CC-BY-SA) per-language JSONL from stdin and
// add up to 4 concise English glosses as 'wiktionary' senses for words that ALREADY
// exist in that language in the DB (i.e. the deck words). Idempotent — dedupes by
// normalized gloss, skips inflection/form-of glosses. Designed to run on the server
// where bandwidth is fast and there is no download time limit:
//
//   curl -sL https://kaikki.org/dictionary/Italian/kaikki.org-dictionary-Italian.jsonl \
//     | node server/scripts/enrich-senses-live.mjs it
import readline from 'node:readline';
import db from '../db/index.js';

const base = process.argv[2];
if (!base) { console.error('usage: enrich-senses-live.mjs <base>'); process.exit(1); }

const lang = db.prepare('SELECT id FROM languages WHERE lang = ? ORDER BY (code = ?) DESC, id LIMIT 1')
  .get(base, `${base}-${base.toUpperCase()}`);
if (!lang) { console.error('no language for', base); process.exit(1); }

// Deck words already in the DB for this language.
const wordId = new Map();
for (const r of db.prepare('SELECT id, text FROM words WHERE language_id = ?').all(lang.id)) wordId.set(r.text, r.id);
console.error(`${base}: ${wordId.size} existing words in DB`);

const norm = (s) => s.toLowerCase().split(/[;,/]+/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).sort().join('|');
const BAD = /\b(inflection|plural|genitive|dative|accusative|nominative|vocative|past participle|present participle|feminine|masculine|form|alternative form|abbreviation) of\b/i;
const defsFor = db.prepare('SELECT text FROM word_definitions WHERE word_id = ?');
const insDef = db.prepare("INSERT INTO word_definitions (word_id, text, source, accepted) VALUES (?, ?, 'wiktionary', 0)");

// Collect first so we can insert in one transaction at the end.
const toAdd = new Map(); // word_id -> [glosses]
let seen = 0;
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line) return;
  let e;
  try { e = JSON.parse(line); } catch { return; }
  if (e.lang_code !== base || !e.word || !Array.isArray(e.senses)) return;
  const wid = wordId.get(e.word);
  if (!wid) return;
  seen += 1;
  const glosses = toAdd.get(wid) || (toAdd.set(wid, []), toAdd.get(wid));
  for (const s of e.senses) {
    if (glosses.length >= 4) break;
    const g = (s.glosses && s.glosses[0]) || '';
    if (!g || BAD.test(g)) continue;
    const short = g.replace(/\s*\([^)]*\)/g, '').replace(/;.*$/, '').trim();
    if (short && short.length <= 70 && !glosses.some((x) => x.toLowerCase() === short.toLowerCase())) glosses.push(short);
  }
});
rl.on('close', () => {
  let words = 0; let senses = 0;
  db.transaction(() => {
    for (const [wid, glosses] of toAdd) {
      if (!glosses.length) continue;
      const keys = new Set(defsFor.all(wid).map((r) => norm(r.text)));
      let added = 0;
      for (const g of glosses) {
        const k = norm(g);
        if (k && !keys.has(k)) { insDef.run(wid, g); keys.add(k); senses += 1; added += 1; }
      }
      if (added) words += 1;
    }
  })();
  console.error(`${base}: ${senses} senses on ${words} words (from ${seen} matched entries).`);
});
