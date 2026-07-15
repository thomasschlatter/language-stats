// Stream a Kaikki (English-Wiktionary, CC-BY-SA) per-language JSONL from stdin and
// point inflected deck words at their lemma using Wiktionary's own form_of / alt_of
// data — no lemmatizer, and irregulars ("went" -> "go", "mice" -> "mouse") come out
// right because the dictionary already records the base form. Only links when BOTH
// the inflected form and the lemma already exist as words in that language (so the
// lemma carries real senses). Idempotent.
//
//   curl -sL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
//     | node server/scripts/link-lemmas-live.mjs en
import readline from 'node:readline';
import db from '../db/index.js';
import { setLemma } from '../models/words.js';

const base = process.argv[2];
if (!base) { console.error('usage: link-lemmas-live.mjs <base>'); process.exit(1); }

const lang = db.prepare('SELECT id FROM languages WHERE lang = ? ORDER BY (code = ?) DESC, id LIMIT 1')
  .get(base, `${base}-${base.toUpperCase()}`);
if (!lang) { console.error('no language for', base); process.exit(1); }

const wordId = new Map(); // text -> id (known words in this language)
for (const r of db.prepare('SELECT id, text FROM words WHERE language_id = ?').all(lang.id)) wordId.set(r.text, r.id);
console.error(`${base}: ${wordId.size} words in DB`);

// For each inflected form, tally which lemma its senses point at (a word can have
// several form_of senses; the most-cited lemma wins).
const votes = new Map(); // wordId -> Map(lemmaText -> count)
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line) return;
  let e;
  try { e = JSON.parse(line); } catch { return; }
  if (e.lang_code !== base || !e.word || !Array.isArray(e.senses)) return;
  const wid = wordId.get(e.word);
  if (!wid) return;
  for (const s of e.senses) {
    const fo = Array.isArray(s.form_of) ? s.form_of : (Array.isArray(s.alt_of) ? s.alt_of : null);
    if (!fo) continue;
    for (const f of fo) {
      const lw = f && (typeof f === 'string' ? f : f.word);
      if (!lw || lw === e.word) continue;
      const v = votes.get(wid) || (votes.set(wid, new Map()), votes.get(wid));
      v.set(lw, (v.get(lw) || 0) + 1);
    }
  }
});
rl.on('close', () => {
  let linked = 0; let skippedNoLemma = 0;
  db.transaction(() => {
    for (const [wid, v] of votes) {
      let best = null; let bc = 0;
      for (const [lw, c] of v) if (c > bc) { bc = c; best = lw; }
      if (!best) continue;
      const lemId = wordId.get(best);
      if (!lemId) { skippedNoLemma += 1; continue; } // lemma not a known word — leave as-is
      if (lemId === wid) continue;
      setLemma(wid, lemId);
      linked += 1;
    }
  })();
  console.error(`${base}: linked ${linked} inflected forms to their lemma (${skippedNoLemma} skipped — lemma not in DB).`);
});
