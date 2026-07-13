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
  db.exec("ALTER TABLE users ADD COLUMN level TEXT NOT NULL DEFAULT 'a1'"); // self-rated CEFR proficiency
}
// UNIQUE index tolerates many NULLs but keeps LINE ids one-per-account.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id)');

export default db;
