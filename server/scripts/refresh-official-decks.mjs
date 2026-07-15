// One-time refresh: push corrected official-deck content (translations, covers,
// new decks) from the seed JSON into an EXISTING database. The normal startup
// loader only INSERTS new decks (idempotent by name); this updates the cards of
// decks that already exist. Safe to re-run. Does NOT touch user-copied decks
// (those are separate rows) or deck votes (deck ids are preserved).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db/index.js';
import { createOfficialDeck, addCards } from '../models/flashcards.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deckDir = join(__dirname, '..', 'seed-data', 'official-decks');

const sysUser = db.prepare("SELECT id FROM users WHERE email = 'official@groupifier.com'").get();
if (!sysUser) { console.error('No system user — run the app once first.'); process.exit(1); }

const pickLang = db.prepare('SELECT id, code FROM languages WHERE lang = ? ORDER BY (code = ?) DESC, id LIMIT 1');
const findDeck = db.prepare('SELECT id FROM decks WHERE language_id = ? AND is_official = 1 AND name = ?');
const delCards = db.prepare('DELETE FROM cards WHERE deck_id = ?');

const files = readdirSync(deckDir).filter((f) => /^[a-z]{2,3}(-[a-z0-9]+)?\.json$/.test(f));
let updated = 0; let created = 0; let cardCount = 0;
for (const f of files) {
  const base = f.replace('.json', '').split('-')[0];
  const lang = pickLang.get(base, `${base}-${base.toUpperCase()}`);
  if (!lang) { console.warn('no language for', f); continue; }
  const decks = JSON.parse(readFileSync(join(deckDir, f), 'utf8'));
  for (const d of decks) {
    if (!d?.name) continue;
    const existing = findDeck.get(lang.id, d.name);
    db.transaction(() => {
      let deckId;
      if (existing) {
        deckId = existing.id;
        delCards.run(deckId);
        if (d.cover !== undefined) {
          db.prepare('UPDATE decks SET cover_url = ?, level = ? WHERE id = ?').run(d.cover || null, d.level || null, deckId);
        } else {
          db.prepare('UPDATE decks SET level = ? WHERE id = ?').run(d.level || null, deckId);
        }
        updated += 1;
      } else {
        deckId = createOfficialDeck({
          systemUserId: sysUser.id, languageId: lang.id, name: d.name, level: d.level || null,
          source: d.source || 'freq+freedict', coverUrl: d.cover || null,
        });
        created += 1;
      }
      addCards({ deckId, userId: sysUser.id, languageId: lang.id, rows: d.cards || [] });
      cardCount += (d.cards || []).length;
    })();
  }
}
console.log(`Official decks refreshed: ${updated} updated, ${created} created, ${cardCount} cards.`);
