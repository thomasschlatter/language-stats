// One-off: turn the noisy word lists extracted from the Tendances course books
// (server/seed-data/book-decks/*.json) into clean official French vocabulary decks
// using the LLM — dropping proper names, classroom-instruction verbs, and
// pedagogical meta-terms, and adding concise English glosses. Writes the result in
// the ensureOfficialDecks() loader format to server/seed-data/official-decks/.
//
//   DATA_DIR=/var/data/language-stats node server/scripts/curate-book-decks.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmAvailable, llmChat } from '../models/llm.js';
import db from '../db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inDir = join(__dirname, '..', 'seed-data', 'book-decks');
const outDir = join(__dirname, '..', 'seed-data', 'official-decks');

const BOOKS = [
  { file: 'tendances-a1.json', name: 'Tendances A1', level: 'A1', out: 'fr-tendances-a1.json' },
  { file: 'tendances-a2.json', name: 'Tendances A2', level: 'A2', out: 'fr-tendances-a2.json' },
];

// Salvage every complete {front, back} object, even if the array is truncated
// (the model can hit the token cap mid-array) or wrapped in prose/code fences.
function extractCards(s) {
  const cards = [];
  const re = /\{\s*"front"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"back"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let m;
  while ((m = re.exec(s))) {
    try { cards.push({ front: JSON.parse(`"${m[1]}"`), back: JSON.parse(`"${m[2]}"`) }); } catch { /* skip */ }
  }
  if (!cards.length) throw new Error('no cards in LLM output');
  return cards;
}

async function curate(words, level) {
  const system = 'You are a French teacher building a CEFR vocabulary flashcard deck. '
    + 'You return ONLY a JSON array, no prose.';
  const user = `From this list of candidate words pulled out of a CEFR ${level} French coursebook, `
    + `keep only genuine French vocabulary a ${level} learner should study. `
    + `EXCLUDE: proper names (people, places, brands), classroom-instruction verbs `
    + `(e.g. lisez, écoutez, complétez, cochez, observez, regardez), and pedagogical/meta terms `
    + `(e.g. exercice, leçon, page, activité, unité, plénum, sous-groupe, transcription). `
    + `Normalise verbs to the infinitive and nouns to the singular with their article where natural. `
    + `Return a JSON array of {"front": "<French word/expression>", "back": "<concise English translation>"}, `
    + `at most 200 entries, best/most useful first. Candidates: ${JSON.stringify(words)}`;
  const out = await llmChat({ system, messages: [{ role: 'user', content: user }], maxTokens: 8000, temperature: 0.2 });
  return extractCards(out)
    .filter((r) => r.front && r.back)
    .map((r) => ({ front: r.front.trim(), back: r.back.trim() }));
}

// No-LLM fallback: keep candidates that have an English gloss in our French sense
// data (drops proper names and junk), minus obvious classroom meta-terms.
const frLang = db.prepare("SELECT id FROM languages WHERE lang = 'fr' ORDER BY (code = 'fr-FR') DESC, id LIMIT 1").get();
const findFr = db.prepare('SELECT id FROM words WHERE language_id = ? AND text = ? COLLATE NOCASE');
const topSense = db.prepare('SELECT text FROM word_definitions WHERE word_id = ? ORDER BY accepted DESC, id LIMIT 1');
const META = new Set('exercice exercices leçon leçons page pages activité activités unité unités transcription transcriptions professeur professeurs élève élèves éditions instituts plénum consigne consignes corrigé corrigés lisez écoutez complétez cochez observez regardez répondez'.split(/\s+/));
function fromDb(words) {
  if (!frLang) return [];
  const cards = [];
  for (const w of words) {
    if (META.has(w)) continue;
    const rec = findFr.get(frLang.id, w);
    if (!rec) continue;
    const s = topSense.get(rec.id);
    if (!s) continue;
    cards.push({ front: w, back: s.text });
  }
  return cards;
}

mkdirSync(outDir, { recursive: true });
for (const b of BOOKS) {
  const outPath = join(outDir, b.out);
  if (existsSync(outPath)) { console.error(`${b.name}: already built, skipping`); continue; }
  let words;
  try { words = JSON.parse(readFileSync(join(inDir, b.file), 'utf8')); } catch { console.error('missing', b.file); continue; }
  let cards = [];
  if (llmAvailable()) {
    try { console.error(`${b.name}: curating ${words.length} candidates via LLM…`); cards = await curate(words, b.level); }
    catch (e) { console.error(`${b.name}: LLM failed (${e.message}); using dictionary fallback`); }
  }
  if (!cards.length) { console.error(`${b.name}: building from French dictionary senses…`); cards = fromDb(words); }
  if (!cards.length) { console.error(`${b.name}: no cards, skipping`); continue; }
  writeFileSync(outPath, JSON.stringify([{ name: b.name, level: b.level, source: 'tendances', cards }]));
  console.error(`${b.name}: ${cards.length} cards -> official-decks/${b.out}`);
}
