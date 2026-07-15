// Import Wiktionary (Kaikki, CC-BY-SA) English glosses as senses for foreign
// words, from server/seed-data/wiktionary/{base}.json ({ word: [glosses] }).
// Gives foreign deck words multiple real senses so the sense-picker/ranking is
// meaningful for them (not just English). Idempotent, deduped, tagged 'wiktionary'.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db/index.js';
import { ensureWord } from '../models/words.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'seed-data', 'wiktionary');

const norm = (s) => s.toLowerCase().split(/[;,/]+/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean).sort().join('|');
const pickLang = db.prepare('SELECT id, code FROM languages WHERE lang = ? ORDER BY (code = ?) DESC, id LIMIT 1');
const defsFor = db.prepare('SELECT text FROM word_definitions WHERE word_id = ?');
const insDef = db.prepare("INSERT INTO word_definitions (word_id, text, source, accepted) VALUES (?, ?, 'wiktionary', 0)");

let files;
try { files = readdirSync(dir).filter((f) => /^[a-z]{2,3}\.json$/.test(f)); } catch { files = []; }

let totalWords = 0; let totalSenses = 0;
for (const f of files) {
  const base = f.replace('.json', '');
  const lang = pickLang.get(base, `${base}-${base.toUpperCase()}`);
  if (!lang) { console.warn('no language for', f); continue; }
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  let words = 0; let senses = 0;
  db.transaction(() => {
    for (const [word, glosses] of Object.entries(data)) {
      if (!Array.isArray(glosses) || !glosses.length) continue;
      const wid = ensureWord(lang.id, word);
      const keys = new Set(defsFor.all(wid).map((r) => norm(r.text)));
      let added = 0;
      for (const g of glosses) {
        const k = norm(g);
        if (k && !keys.has(k)) { insDef.run(wid, g); keys.add(k); senses += 1; added += 1; }
      }
      if (added) words += 1;
    }
  })();
  console.log(`${lang.code}: ${senses} senses on ${words} words`);
  totalWords += words; totalSenses += senses;
}
console.log(`Wiktionary import: ${totalSenses} senses added across ${totalWords} words.`);
