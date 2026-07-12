// Re-runnable Wiktionary scraper.
//
// Fetches word definitions from the Wiktionary REST API and stores them on the
// dictionary word entries (so clicking a word shows a real explanation). It is
// incremental: words scraped recently are skipped unless --force, so you can
// re-run it any time to fill in more words or refresh stale ones.
//
//   node server/scripts/scrape.js [langCode] [limit] [--force]
//   npm run scrape -- de-DE 500
//
// With no langCode it scrapes every language that has frequency data.

import './../db/index.js';
import { listLanguages } from '../models/languages.js';
import { topWords, totalCount } from '../models/frequency.js';
import { findWord, upsertScrapedWord } from '../models/words.js';

const UA = 'language-stats/0.1 (https://github.com/thomasschlatter/language-stats; educational project)';
const REST = 'https://en.wiktionary.org/api/rest_v1/page/definition/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

async function fetchDefinition(word, baseLang) {
  const res = await fetch(REST + encodeURIComponent(word), { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const entries = data[baseLang];
  if (!Array.isArray(entries) || !entries.length) return null;
  // Take up to two senses from the first part of speech.
  const e = entries[0];
  const defs = (e.definitions || []).map((d) => stripHtml(d.definition || '')).filter(Boolean).slice(0, 2);
  if (!defs.length) return null;
  return (e.partOfSpeech ? `(${e.partOfSpeech}) ` : '') + defs.join('; ');
}

async function scrapeLanguage(language, limit, { force, delay }) {
  const words = topWords(language.id, limit);
  let updated = 0, missed = 0, skipped = 0, errors = 0, i = 0;
  for (const w of words) {
    i += 1;
    const existing = findWord(language.id, w.word);
    if (existing?.scraped_at && !force) { skipped += 1; continue; }
    try {
      const def = await fetchDefinition(w.word, language.lang);
      if (def) { upsertScrapedWord({ languageId: language.id, text: w.word, meaning: def }); updated += 1; }
      else missed += 1;
    } catch { errors += 1; }
    if (i % 25 === 0) console.log(`  ${language.code}: ${i}/${words.length} (updated ${updated}, missed ${missed}, err ${errors})`);
    await sleep(delay);
  }
  console.log(`${language.code}: done — updated ${updated}, missed ${missed}, skipped ${skipped}, errors ${errors}`);
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const positional = args.filter((a) => !a.startsWith('--'));
const langArg = positional.find((a) => Number.isNaN(Number(a)));
const limit = Number(positional.find((a) => !Number.isNaN(Number(a)))) || 200;
const delay = Number(process.env.SCRAPE_DELAY_MS) || 150;

const targets = listLanguages().filter((l) => (langArg ? l.code === langArg : true) && totalCount(l.id) > 0);
if (!targets.length) { console.log('No matching languages with frequency data.'); process.exit(0); }

console.log(`Scraping ${targets.map((l) => l.code).join(', ')} (up to ${limit} words each, delay ${delay}ms)…`);
for (const l of targets) await scrapeLanguage(l, limit, { force, delay });
console.log('Scrape complete.');
process.exit(0);
