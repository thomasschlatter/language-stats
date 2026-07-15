// Ensure the full Glottolog-scale language catalogue exists (server/seed-data/
// languages.json), with glottocode / ISO 639-3 / family / macroarea + an
// official-status `tier`. Idempotent: creates base languages not present yet and
// backfills metadata where missing. Safe to run on every startup — this is how
// an existing DB picks up the catalogue (seed.js only runs on an empty DB).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function ensureAllLanguages() {
  let seed;
  try {
    seed = JSON.parse(readFileSync(join(__dirname, '..', 'seed-data', 'languages.json'), 'utf8'));
  } catch { return; }
  if (!Array.isArray(seed) || !seed.length) return;

  const bases = new Set(db.prepare('SELECT DISTINCT lang FROM languages').all().map((r) => r.lang));
  const ins = db.prepare(
    `INSERT OR IGNORE INTO languages (code, lang, name, glottocode, iso639_3, family, macroarea, tier)
     VALUES (@code, @lang, @name, @glottocode, @iso639_3, @family, @macroarea, @tier)`
  );
  // Backfill metadata onto existing rows of the same base that don't have a tier yet.
  const upd = db.prepare(
    `UPDATE languages SET glottocode = COALESCE(glottocode, @glottocode),
        iso639_3 = COALESCE(iso639_3, @iso639_3), family = COALESCE(family, @family),
        macroarea = COALESCE(macroarea, @macroarea), tier = @tier
     WHERE lang = @lang AND (tier IS NULL OR tier = '')`
  );

  let created = 0; let updated = 0;
  db.transaction(() => {
    for (const s of seed) {
      const row = {
        code: s.code, lang: s.lang, name: s.name,
        glottocode: s.glottocode || null, iso639_3: s.iso639_3 || null,
        family: s.family || null, macroarea: s.macroarea || null, tier: s.tier || 'other',
      };
      if (bases.has(s.lang)) { updated += upd.run(row).changes; } else { created += ins.run(row).changes; bases.add(s.lang); }
    }
  })();
  if (created || updated) console.log(`Languages: ${created} added, ${updated} metadata-updated (catalogue of ${seed.length}).`);
}
