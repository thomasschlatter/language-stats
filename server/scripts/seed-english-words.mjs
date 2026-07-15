// Seed English word entries from the OpenSubtitles frequency list so WordNet
// (and future cross-language links) have English words to attach senses to.
// Idempotent (ensureWord). EN_WORDS caps how many top words to seed.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db/index.js';
import { ensureWord } from '../models/words.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '..', 'seed-data', 'opensubtitles', 'en_50k.txt');

const lang = db.prepare("SELECT id, code FROM languages WHERE lang = 'en' ORDER BY (code = 'en-US') DESC, id LIMIT 1").get();
if (!lang) { console.error('No English language in DB.'); process.exit(1); }

const N = Number(process.env.EN_WORDS || 12000);
const lines = readFileSync(file, 'utf8').split('\n');
let n = 0;
const tx = db.transaction(() => {
  for (const line of lines) {
    const w = line.split(/\s+/)[0];
    if (!w || w.length < 2 || !/^[a-z][a-z'-]*$/i.test(w)) continue;
    ensureWord(lang.id, w);
    n += 1;
    if (n >= N) break;
  }
});
tx();
console.log(`Seeded ${n} English words into ${lang.code}.`);
