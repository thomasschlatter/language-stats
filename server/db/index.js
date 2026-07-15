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

// --- languages: Glottolog/ISO metadata + official-status tier. `tier` keeps the
// long tail off the surface (only official/regional shown by default). ---
const langCols = db.prepare('PRAGMA table_info(languages)').all().map((c) => c.name);
for (const [col, def] of [
  ['glottocode', 'TEXT'], ['iso639_3', 'TEXT'], ['family', 'TEXT'],
  ['macroarea', 'TEXT'], ['tier', 'TEXT'],
]) {
  if (!langCols.includes(col)) db.exec(`ALTER TABLE languages ADD COLUMN ${col} ${def}`);
}
db.exec('CREATE INDEX IF NOT EXISTS idx_languages_tier ON languages(tier)');

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
if (!deckCols.includes('cover_url')) {
  // Reference to a book/deck cover image. Collected now, but only SERVED to
  // clients when SHOW_DECK_COVERS=1 (off by default) — so publisher artwork
  // stays hidden until we're licensed to show it. See routes/flashcards.js.
  db.exec('ALTER TABLE decks ADD COLUMN cover_url TEXT');
}
db.exec(`CREATE TABLE IF NOT EXISTS deck_votes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, deck_id)
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_decks_public ON decks(is_public, is_official)');

// --- sense-network: a card can point at a dictionary sense (word_definitions).
// When set, the card's meaning is that live, votable sense; when NULL the card
// falls back to its own `back` string. See memory/sense-network.md.
const cardCols = db.prepare('PRAGMA table_info(cards)').all().map((c) => c.name);
if (!cardCols.includes('definition_id')) {
  db.exec('ALTER TABLE cards ADD COLUMN definition_id INTEGER REFERENCES word_definitions(id) ON DELETE SET NULL');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_cards_definition ON cards(definition_id)');

// --- Groups: user-made group chats you join via an invite link. ---
db.exec(`CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS group_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  body_lang_id INTEGER REFERENCES languages(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, id)');
// Open groups are discoverable + joinable without an invite; private (default) need the link.
const groupCols = db.prepare('PRAGMA table_info(groups)').all().map((c) => c.name);
if (!groupCols.includes('is_open')) db.exec('ALTER TABLE groups ADD COLUMN is_open INTEGER NOT NULL DEFAULT 0');

export default db;
