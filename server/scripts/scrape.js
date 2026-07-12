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
import { findWord, ensureWord, markWordScraped } from '../models/words.js';
import { addDefinition, clearWiktionaryDefinitions } from '../models/definitions.js';
import { fetchDefinitions } from '../lib/wiktionary.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrapeLanguage(language, limit, { force, delay }) {
  const words = topWords(language.id, limit);
  let updated = 0, missed = 0, skipped = 0, errors = 0, i = 0;
  for (const w of words) {
    i += 1;
    const existing = findWord(language.id, w.word);
    if (existing?.scraped_at && !force) { skipped += 1; continue; }
    try {
      const defs = await fetchDefinitions(w.word, language.lang);
      const wordId = ensureWord(language.id, w.word);
      if (force) clearWiktionaryDefinitions(wordId);
      for (const d of defs) addDefinition({ wordId, text: d, source: 'wiktionary', accepted: true });
      markWordScraped(wordId);
      if (defs.length) updated += 1; else missed += 1;
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
