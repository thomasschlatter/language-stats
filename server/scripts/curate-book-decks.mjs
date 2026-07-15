// One-off: turn the noisy word lists extracted from the Tendances course books
// (server/seed-data/book-decks/*.json) into clean official French vocabulary decks
// using the LLM — dropping proper names, classroom-instruction verbs, and
// pedagogical meta-terms, and adding concise English glosses. Writes the result in
// the ensureOfficialDecks() loader format to server/seed-data/official-decks/.
//
//   DATA_DIR=/var/data/language-stats node server/scripts/curate-book-decks.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmAvailable, llmChat } from '../models/llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inDir = join(__dirname, '..', 'seed-data', 'book-decks');
const outDir = join(__dirname, '..', 'seed-data', 'official-decks');

const BOOKS = [
  { file: 'tendances-a1.json', name: 'Tendances A1', level: 'A1', out: 'fr-tendances-a1.json' },
  { file: 'tendances-a2.json', name: 'Tendances A2', level: 'A2', out: 'fr-tendances-a2.json' },
];

function extractJsonArray(s) {
  const a = s.indexOf('[');
  const b = s.lastIndexOf(']');
  if (a === -1 || b === -1) throw new Error('no JSON array in LLM output');
  return JSON.parse(s.slice(a, b + 1));
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
  return extractJsonArray(out).filter((r) => r && r.front && r.back)
    .map((r) => ({ front: String(r.front).trim(), back: String(r.back).trim() }));
}

if (!llmAvailable()) { console.error('LLM not configured (ANTHROPIC_API_KEY missing).'); process.exit(1); }
mkdirSync(outDir, { recursive: true });
for (const b of BOOKS) {
  let words;
  try { words = JSON.parse(readFileSync(join(inDir, b.file), 'utf8')); } catch { console.error('missing', b.file); continue; }
  console.error(`${b.name}: curating ${words.length} candidates…`);
  const cards = await curate(words, b.level);
  const deck = [{ name: b.name, level: b.level, source: 'tendances', cards }];
  writeFileSync(join(outDir, b.out), JSON.stringify(deck));
  console.error(`${b.name}: ${cards.length} cards -> official-decks/${b.out}`);
}
