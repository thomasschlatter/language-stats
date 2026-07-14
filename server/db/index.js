// Database connection + one-time schema initialisation.
//
// Everything that touches SQLite goes through the single `db` instance
// exported here. Swapping the storage engine later means changing this file
// (and the query modules) — the routes stay the same.

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Store the database file under DATA_DIR (set this to a persistent volume in
// production) or <project>/data locally.
const dataDir = process.env.DATA_DIR || join(__dirname, '..', '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'language-stats.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply the schema (all statements are IF NOT EXISTS, so this is idempotent).
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// --- lightweight column migrations (ALTER TABLE has no IF NOT EXISTS) ---
const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userCols.includes('line_user_id')) {
  db.exec('ALTER TABLE users ADD COLUMN line_user_id TEXT');
}
if (!userCols.includes('avatar_image')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_image TEXT'); // URL/path to a personal photo avatar
}
if (!userCols.includes('dm_last_read_id')) {
  db.exec('ALTER TABLE users ADD COLUMN dm_last_read_id INTEGER NOT NULL DEFAULT 0'); // for the unread-DM badge
}
if (!userCols.includes('level')) {
  db.exec("ALTER TABLE users ADD COLUMN level TEXT NOT NULL DEFAULT 'a1'"); // self-rated CEFR proficiency (legacy global)
}
if (!userCols.includes('primary_native')) {
  db.exec('ALTER TABLE users ADD COLUMN primary_native TEXT'); // which native language drives click-to-translate
}
// Per-language proficiency: each learning language has its own CEFR level.
const ulCols = db.prepare('PRAGMA table_info(user_languages)').all().map((c) => c.name);
if (!ulCols.includes('level')) {
  db.exec("ALTER TABLE user_languages ADD COLUMN level TEXT NOT NULL DEFAULT 'a1'");
  // Seed existing learning rows from the old global users.level so nobody loses their rating.
  db.exec("UPDATE user_languages SET level = (SELECT level FROM users WHERE users.id = user_languages.user_id) WHERE role = 'learning'");
}
// UNIQUE index tolerates many NULLs but keeps LINE ids one-per-account.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id)');

// --- shared/official decks: browse + upvote (like tips/articles) ---
const deckCols = db.prepare('PRAGMA table_info(decks)').all().map((c) => c.name);
if (!deckCols.includes('is_official')) {
  db.exec('ALTER TABLE decks ADD COLUMN is_official INTEGER NOT NULL DEFAULT 0');
}
if (!deckCols.includes('is_public')) {
  db.exec('ALTER TABLE decks ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0');
}
if (!deckCols.includes('votes')) {
  db.exec('ALTER TABLE decks ADD COLUMN votes INTEGER NOT NULL DEFAULT 0');
}
if (!deckCols.includes('level')) {
  db.exec('ALTER TABLE decks ADD COLUMN level TEXT'); // CEFR a1..c2 for leveled decks
}
if (!deckCols.includes('copied_from')) {
  db.exec('ALTER TABLE decks ADD COLUMN copied_from INTEGER'); // source deck when copied to study
}
db.exec(`CREATE TABLE IF NOT EXISTS deck_votes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, deck_id)
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_decks_public ON decks(is_public, is_official)');

export default db;
