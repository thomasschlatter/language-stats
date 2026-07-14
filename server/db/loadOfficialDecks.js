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

const __dirname = dirname(fileURLToPath(import.meta.url));
const deckDir = join(__dirname, '..', 'seed-data', 'official-decks');

const SYS_EMAIL = 'official@groupifier.com';
const SYS_USERNAME = 'Groupifier';

// The system user owns every official deck. Never logs in (unusable password).
function ensureSystemUser() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(SYS_EMAIL);
  if (existing) return existing.id;
  const info = db.prepare(
    'INSERT INTO users (email, username, password_hash, bio) VALUES (?, ?, ?, ?)'
  ).run(SYS_EMAIL, SYS_USERNAME, '!', 'Official Groupifier decks and word lists.');
  return info.lastInsertRowid;
}

export function ensureOfficialDecks() {
  let files;
  try {
    files = readdirSync(deckDir).filter((f) => /^[a-z]{2,3}\.json$/.test(f));
  } catch {
    return;
  }
  if (!files.length) return;

  const pickLang = db.prepare(
    'SELECT id, code FROM languages WHERE lang = ? ORDER BY (code = ?) DESC, id LIMIT 1'
  );
  const hasOfficial = db.prepare(
    "SELECT 1 FROM decks WHERE language_id = ? AND is_official = 1 AND source = 'freq+freedict' LIMIT 1"
  );

  let systemUserId = null;
  let loadedLangs = 0;
  let loadedDecks = 0;
  for (const f of files) {
    const base = f.replace('.json', '');
    const lang = pickLang.get(base, `${base}-${base.toUpperCase()}`);
    if (!lang || hasOfficial.get(lang.id)) continue;
    let decks;
    try {
      decks = JSON.parse(readFileSync(join(deckDir, f), 'utf8'));
    } catch (e) {
      console.warn(`Official decks parse failed for ${f}:`, e.message);
      continue;
    }
    if (!Array.isArray(decks) || !decks.length) continue;
    if (systemUserId === null) systemUserId = ensureSystemUser();
    try {
      db.transaction(() => {
        for (const d of decks) {
          const deckId = createOfficialDeck({
            systemUserId, languageId: lang.id, name: d.name, level: d.level || null, source: d.source || 'freq+freedict',
          });
          addCards({ deckId, userId: systemUserId, languageId: lang.id, rows: d.cards || [] });
          loadedDecks += 1;
        }
      })();
      loadedLangs += 1;
    } catch (e) {
      console.warn(`Official decks load failed for ${lang.code}:`, e.message);
    }
  }
  if (loadedDecks) {
    console.log(`Official decks: loaded ${loadedDecks} deck(s) across ${loadedLangs} language(s).`);
  }
}
