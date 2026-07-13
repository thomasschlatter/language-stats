// Adds the world-languages catalogue (server/db/extra-languages.js) to an
// already-seeded database. Idempotent — skips locales that already exist.
//
//   DATA_DIR=/var/data/language-stats node server/scripts/add-languages.js
//
import { getLanguageByCode, createLanguage } from '../models/languages.js';
import { EXTRA_LANGUAGES } from '../db/extra-languages.js';

let added = 0;
for (const [code, lang, country, name] of EXTRA_LANGUAGES) {
  if (getLanguageByCode(code)) continue;
  createLanguage({ code, lang, country, name });
  added++;
  console.log(`+ ${code}  ${name}`);
}
console.log(`\nDone. Added ${added} language(s); ${EXTRA_LANGUAGES.length - added} already present.`);
