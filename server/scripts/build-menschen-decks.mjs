// Build per-Lektion "Menschen A1.1 · Lektion N" official decks from the parsed
// Arbeitsbuch Lernwortschatz (server/seed-data/book-decks/menschen-a11.json). Each
// candidate is validated against the German dictionary (drops OCR garble) and gets
// its top English sense as the back. Front keeps the German word (with article for
// nouns). Pass --dry to preview Lektion 1 without writing.
//
//   DATA_DIR=/var/data/language-stats node server/scripts/build-menschen-decks.mjs [--dry]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db/index.js';
import { createOfficialDeck, addCards } from '../models/flashcards.js';
import { getBotUserId } from '../models/bot.js';

const dry = process.argv.includes('--dry');
const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '..', 'seed-data', 'book-decks', 'menschen-a11.json'), 'utf8'));

const lang = db.prepare("SELECT id FROM languages WHERE lang = 'de' ORDER BY (code = 'de-DE') DESC, id LIMIT 1").get();
if (!lang) { console.error('no German language'); process.exit(1); }
const findWord = db.prepare('SELECT id FROM words WHERE language_id = ? AND text = ? COLLATE NOCASE');
const topSense = db.prepare('SELECT text FROM word_definitions WHERE word_id = ? ORDER BY accepted DESC, id LIMIT 1');
const deckExists = db.prepare('SELECT 1 FROM decks WHERE language_id = ? AND is_official = 1 AND name = ? LIMIT 1');

function cardsFor(words) {
  const rows = [];
  for (const w of words) {
    const rec = findWord.get(lang.id, w.lookup);
    if (!rec) continue; // not a dictionary word -> drop OCR garble / English / headers
    const s = topSense.get(rec.id);
    if (!s) continue;
    rows.push({ front: w.front, back: s.text });
  }
  return rows;
}

if (dry) {
  const l1 = data[0];
  const rows = cardsFor(l1.words);
  console.error(`Lektion ${l1.lektion}: ${l1.words.length} candidates -> ${rows.length} valid cards`);
  for (const r of rows) console.error(`  ${r.front}  =  ${r.back}`);
  process.exit(0);
}

const systemUserId = getBotUserId();
let made = 0;
for (const l of data) {
  const name = `Menschen A1.1 · Lektion ${l.lektion}`;
  if (deckExists.get(lang.id, name)) continue;
  const rows = cardsFor(l.words);
  if (rows.length < 5) { console.error(`skip ${name}: only ${rows.length} cards`); continue; }
  db.transaction(() => {
    const deckId = createOfficialDeck({ systemUserId, languageId: lang.id, name, level: 'A1', source: 'menschen' });
    addCards({ deckId, userId: systemUserId, languageId: lang.id, rows });
  })();
  made += 1;
  console.error(`${name}: ${rows.length} cards`);
}
console.error(`built ${made} Menschen Lektion decks`);
