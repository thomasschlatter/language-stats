// Load official starter flashcard decks (server/seed-data/official-decks/{base}.json)
// into the DB, owned by a system "Groupifier" user and flagged is_official +
// is_public so they show up in the shared-deck browser. Idempotent: skips any
// language that already has official decks from this source, so it's safe to run
// on every startup (this is how existing production DBs pick up new decks —
// seed.js only runs on a fresh, empty DB).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './index.js';
import { createOfficialDeck, addCards } from '../models/flashcards.js';
import { getBotUserId } from '../models/bot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const deckDir = join(__dirname, '..', 'seed-data', 'official-decks');

// Official decks are owned by the shared Foxy bot user.
const ensureSystemUser = getBotUserId;

export function ensureOfficialDecks() {
  let files;
  try {
    // {base}.json (frequency decks) or {base}-{tag}[-{tag}…].json
    // (e.g. de-menschen.json, fr-tendances-a1.json).
    files = readdirSync(deckDir).filter((f) => /^[a-z]{2,3}(-[a-z0-9]+)*\.json$/.test(f));
  } catch {
    return;
  }
  if (!files.length) return;

  const pickLang = db.prepare(
    'SELECT id, code FROM languages WHERE lang = ? ORDER BY (code = ?) DESC, id LIMIT 1'
  );
  // Deck-level idempotency: skip a deck we already created (by language + name),
  // so adding a new file to an already-loaded language still loads just the new decks.
  const deckExists = db.prepare(
    'SELECT 1 FROM decks WHERE language_id = ? AND is_official = 1 AND name = ? LIMIT 1'
  );

  let systemUserId = null;
  let loadedDecks = 0;
  for (const f of files) {
    const base = f.replace('.json', '').split('-')[0];
    const lang = pickLang.get(base, `${base}-${base.toUpperCase()}`);
    if (!lang) continue;
    let decks;
    try {
      decks = JSON.parse(readFileSync(join(deckDir, f), 'utf8'));
    } catch (e) {
      console.warn(`Official decks parse failed for ${f}:`, e.message);
      continue;
    }
    if (!Array.isArray(decks) || !decks.length) continue;
    for (const d of decks) {
      if (!d?.name || deckExists.get(lang.id, d.name)) continue;
      if (systemUserId === null) systemUserId = ensureSystemUser();
      try {
        db.transaction(() => {
          const deckId = createOfficialDeck({
            systemUserId, languageId: lang.id, name: d.name, level: d.level || null,
            source: d.source || 'freq+freedict', coverUrl: d.cover || null,
          });
          addCards({ deckId, userId: systemUserId, languageId: lang.id, rows: d.cards || [] });
        })();
        loadedDecks += 1;
      } catch (e) {
        console.warn(`Official deck load failed (${lang.code} / ${d.name}):`, e.message);
      }
    }
  }
  if (loadedDecks) console.log(`Official decks: loaded ${loadedDecks} new deck(s).`);
}
