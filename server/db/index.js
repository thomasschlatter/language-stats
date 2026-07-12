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

export default db;
