// Build per-Lektion "Menschen A1.1 · Lektion N" official decks from the parsed
// Arbeitsbuch Lernwortschatz (server/seed-data/book-decks/menschen-a11.json).
// Each candidate is glossed to English: from our German dictionary if we have it,
// else fetched live from Wiktionary (and cached, which also grows the dictionary).
// A word Wiktionary doesn't know is OCR garble → dropped. Front keeps the German
// word (article for nouns). Pass --dry to preview Lektion 1 without writing.
//
//   DATA_DIR=/var/data/language-stats node server/scripts/build-menschen-decks.mjs [--dry]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db/index.js';
import { createOfficialDeck, addCards } from '../models/flashcards.js';
import { getBotUserId } from '../models/bot.js';
import { ensureWord } from '../models/words.js';
import { addDefinition } from '../models/definitions.js';
import { fetchDefinitions } from '../lib/wiktionary.js';

const dry = process.argv.includes('--dry');
const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '..', 'seed-data', 'book-decks', 'menschen-a11.json'), 'utf8'));

const lang = db.prepare("SELECT id, lang FROM languages WHERE lang = 'de' ORDER BY (code = 'de-DE') DESC, id LIMIT 1").get();
if (!lang) { console.error('no German language'); process.exit(1); }
const findWord = db.prepare('SELECT id FROM words WHERE language_id = ? AND text = ? COLLATE NOCASE');
const topSense = db.prepare('SELECT text FROM word_definitions WHERE word_id = ? ORDER BY accepted DESC, id LIMIT 1');
const deckExists = db.prepare('SELECT 1 FROM decks WHERE language_id = ? AND is_official = 1 AND name = ? LIMIT 1');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Skip form-of / inflection glosses — they're noise on a vocabulary card.
const BAD = /\b(inflection|plural|singular|genitive|dative|accusative|nominative|vocative|past participle|present participle|imperative|subjunctive|form|alternative form|abbreviation) of\b/i;
// Grammar-metadata masquerading as a definition ("first-person singular present").
const META = /\b(first-person|second-person|third-person|person singular|person plural|subjunctive|indicative|imperative mood|participle|conjugation|declension)\b/i;
// "(Noun) country (a nation…)" -> "country": drop POS + parentheticals, first sense, cap length.
const clean = (g) => g.replace(/^\([^)]*\)\s*/, '').replace(/\s*\([^)]*\)/g, '').split(/[;]/)[0].trim().slice(0, 60);
// First gloss that's a real meaning (not a form-of pointer).
const bestGloss = (glosses) => {
  for (const g of glosses) { const c = clean(g); if (c && !BAD.test(g) && !META.test(g) && !META.test(c)) return c; }
  return null;
};

// English gloss for a German word: DB first, then Wiktionary (cached).
async function glossOf(word) {
  const rec = findWord.get(lang.id, word);
  if (rec) {
    const all = db.prepare('SELECT text FROM word_definitions WHERE word_id = ? ORDER BY accepted DESC, id').all(rec.id).map((r) => r.text);
    const g = bestGloss(all);
    if (g) return g;
  }
  try {
    const defs = await fetchDefinitions(word, lang.lang);
    await sleep(120); // be polite to Wiktionary
    if (!defs.length) return null;
    const wid = ensureWord(lang.id, word);
    for (const d of defs) addDefinition({ wordId: wid, text: d.replace(/^\([^)]*\)\s*/, ''), source: 'wiktionary', accepted: true });
    return bestGloss(defs);
  } catch { return null; }
}

async function cardsFor(words) {
  const rows = [];
  for (const w of words) {
    const back = await glossOf(w.lookup);
    if (back) rows.push({ front: w.front, back });
  }
  return rows;
}

if (dry) {
  const l1 = data[0];
  const rows = await cardsFor(l1.words);
  console.error(`Lektion ${l1.lektion}: ${l1.words.length} candidates -> ${rows.length} cards`);
  for (const r of rows) console.error(`  ${r.front}  =  ${r.back}`);
  process.exit(0);
}

const systemUserId = getBotUserId();
let made = 0;
for (const l of data) {
  const name = `Menschen A1.1 · Lektion ${l.lektion}`;
  if (deckExists.get(lang.id, name)) { console.error(`skip ${name}: exists`); continue; }
  const rows = await cardsFor(l.words);
  if (rows.length < 5) { console.error(`skip ${name}: only ${rows.length} cards`); continue; }
  db.transaction(() => {
    const deckId = createOfficialDeck({ systemUserId, languageId: lang.id, name, level: 'A1', source: 'menschen' });
    addCards({ deckId, userId: systemUserId, languageId: lang.id, rows });
  })();
  made += 1;
  console.error(`${name}: ${rows.length} cards`);
}
console.error(`built ${made} Menschen Lektion decks`);
