// Load OpenSubtitles word-frequency lists (server/seed-data/opensubtitles/*_50k.txt,
// hermitdave/FrequencyWords, MIT) into word_frequencies for every language that
// has a file. Idempotent (skips languages already loaded), so it's safe to run on
// every startup — this is how existing production DBs pick up newly-added lists
// (seed.js only runs on a fresh, empty DB).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const freqDir = join(__dirname, '..', 'seed-data', 'opensubtitles');

const isLoaded = (languageId) =>
  db.prepare('SELECT 1 FROM word_frequencies WHERE language_id = ? LIMIT 1').get(languageId);

function loadFile(languageId, file) {
  const raw = readFileSync(file, 'utf8');
  const insert = db.prepare(
    'INSERT OR IGNORE INTO word_frequencies (language_id, rank, word, count, cum) VALUES (?, ?, ?, ?, ?)'
  );
  const load = db.transaction((lines) => {
    let rank = 0;
    let cum = 0;
    for (const line of lines) {
      const sp = line.indexOf(' ');
      if (sp < 1) continue;
      const word = line.slice(0, sp);
      const count = parseInt(line.slice(sp + 1), 10);
      if (!word || !Number.isFinite(count)) continue;
      rank += 1;
      cum += count;
      insert.run(languageId, rank, word, count, cum);
    }
    return rank;
  });
  return load(raw.split('\n'));
}

// Map a base code (de, fr, ja…) to the primary locale language in the DB,
// preferring the {base}-{BASE} form (de -> de-DE) over regional variants.
export function ensureAllFrequencies() {
  let files;
  try {
    files = readdirSync(freqDir).filter((f) => /^[a-z]{2,3}_50k\.txt$/.test(f));
  } catch {
    return;
  }
  const pickLang = db.prepare(
    'SELECT id, code FROM languages WHERE lang = ? ORDER BY (code = ?) DESC, id LIMIT 1'
  );
  let loaded = 0;
  for (const f of files) {
    const base = f.split('_')[0];
    const lang = pickLang.get(base, `${base}-${base.toUpperCase()}`);
    if (!lang || isLoaded(lang.id)) continue;
    try {
      const n = loadFile(lang.id, join(freqDir, f));
      console.log(`Loaded ${n} ${lang.code} word frequencies.`);
      loaded += 1;
    } catch (e) {
      console.warn(`Frequency load failed for ${f}:`, e.message);
    }
  }
  if (loaded) console.log(`Frequency lists: loaded ${loaded} new language(s).`);
}
