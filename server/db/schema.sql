-- Language Stats — database schema
--
-- The dictionary is modelled as a GRAPH:
--   * words       -> nodes
--   * word_links  -> edges (translation / synonym / related ...)
--
-- SQLite is used as the storage engine so the barebone runs with zero
-- external infrastructure. The graph shape (nodes + typed edges) means the
-- data can be migrated to a dedicated graph DB (Neo4j, etc.) later without
-- rethinking the model.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Languages (shown in the left-hand sidebar)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS languages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,         -- ISO-ish code, e.g. 'de', 'en'
  name       TEXT NOT NULL,                -- e.g. 'German'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Users (sign up / sign in / sign out)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Words = graph NODES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS words (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,               -- the word/phrase itself
  meaning     TEXT,                        -- short definition in the same language
  notes       TEXT,                        -- optional extra notes
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (language_id, text)
);

CREATE INDEX IF NOT EXISTS idx_words_language ON words(language_id);
CREATE INDEX IF NOT EXISTS idx_words_text     ON words(text);

-- ---------------------------------------------------------------------------
-- Word links = graph EDGES
--
-- A link connects two words. Links are stored once but treated as
-- bidirectional by the API (a translation goes both ways).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS word_links (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  target_word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'translation', -- translation | synonym | related
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_word_id, target_word_id, type),
  CHECK (source_word_id <> target_word_id)
);

CREATE INDEX IF NOT EXISTS idx_links_source ON word_links(source_word_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON word_links(target_word_id);

-- ---------------------------------------------------------------------------
-- Tips = community-shared language-learning advice
-- (stats-related or not — free text for now)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tips (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tips_language ON tips(language_id);
