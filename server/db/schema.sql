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
-- A "language" is really a LOCALE = language + country, so dialects are
-- first-class:  de-DE (Germany), de-AT (Austria), de-CH (Switzerland), en-US…
CREATE TABLE IF NOT EXISTS languages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,         -- locale code, e.g. 'de-DE', 'en-US'
  lang       TEXT NOT NULL,                -- base language, e.g. 'de'
  country    TEXT,                         -- ISO country, e.g. 'DE', 'CH'
  name       TEXT NOT NULL,                -- display name, e.g. 'German (Germany)'
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
  bio           TEXT,
  interests     TEXT,                              -- comma-separated tags
  avatar        TEXT,                              -- JSON: layer indices for the character sprite
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Which languages a user speaks natively vs is learning (drives partner match).
CREATE TABLE IF NOT EXISTS user_languages (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,                       -- 'native' | 'learning'
  PRIMARY KEY (user_id, language_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_languages ON user_languages(language_id, role);

-- Follow graph.
CREATE TABLE IF NOT EXISTS follows (
  follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, following_id)
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
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id  INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE, -- which language it's about
  body_lang_id INTEGER REFERENCES languages(id),                           -- which language it's written in
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tips_language ON tips(language_id);

-- ---------------------------------------------------------------------------
-- Word frequencies (from OpenSubtitles) — powers the "% of conversation"
-- coverage buttons. `cum` is the running cumulative count through this rank,
-- pre-computed at seed time so coverage queries are trivial.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS word_frequencies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  rank        INTEGER NOT NULL,      -- 1 = most frequent
  word        TEXT NOT NULL,
  count       INTEGER NOT NULL,      -- raw occurrences in the corpus
  cum         INTEGER NOT NULL,      -- cumulative count through this rank
  UNIQUE (language_id, word)
);

CREATE INDEX IF NOT EXISTS idx_freq_lang_rank ON word_frequencies(language_id, rank);

-- ---------------------------------------------------------------------------
-- Articles = the clickable "cards" shown under a language. Official cards are
-- written by the site; users can also author their own. `body` holds a small
-- markup source (see server/lib/... on the client) that renders headings,
-- paragraphs, and interactive [coverage] widgets.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id  INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE, -- which language it's about
  body_lang_id INTEGER REFERENCES languages(id),                           -- which language it's written in
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  summary      TEXT,
  body         TEXT NOT NULL,
  author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,            -- NULL = official/site
  is_official  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (language_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language_id);

-- ---------------------------------------------------------------------------
-- Chat messages — one room per language. Like everything else, each message is
-- prose in a locale, so every word rendered from it is clickable/translatable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id  INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE, -- the room
  body_lang_id INTEGER REFERENCES languages(id),                           -- written-in locale
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(language_id, id);

-- ---------------------------------------------------------------------------
-- Per-user word progress. Tracked by (lowercased) word form + locale, so ANY
-- clickable word — not only dictionary entries — can be marked. Joins to
-- word_frequencies give each user their conversation-coverage %.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_words (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  word_lc     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'learning',   -- 'learning' | 'known'
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, language_id, word_lc)
);

CREATE INDEX IF NOT EXISTS idx_user_words ON user_words(user_id, language_id, status);

-- ---------------------------------------------------------------------------
-- 1-on-1 direct messages + inline corrections (the language-exchange core).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dm_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  body_lang_id INTEGER REFERENCES languages(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON dm_messages(sender_id, id);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON dm_messages(recipient_id, id);

-- A correction proposes a fixed version of someone else's message.
CREATE TABLE IF NOT EXISTS dm_corrections (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id     INTEGER NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
  corrector_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  corrected_text TEXT NOT NULL,
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dm_corr ON dm_corrections(message_id);

-- Card upvotes — one vote per user per article.
CREATE TABLE IF NOT EXISTS article_votes (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (article_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Lexicon: part-of-speech + gender per (lowercased) word form, aggregated from
-- the Universal Dependencies German treebank. Used to break the frequency
-- coverage sets down by POS and to analyse noun gender. Keyed lowercased to
-- match the (lowercased) OpenSubtitles frequency list.
-- (spaCy could later supplement this for rarer words — see README.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lexicon (
  language_id INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  word_lc     TEXT NOT NULL,      -- lowercased key (matches the freq list)
  form        TEXT,               -- dominant CASED form (German nouns keep their capital)
  pos         TEXT,               -- UPOS: NOUN, VERB, ADJ, ADV, DET, PRON, ...
  gender      TEXT,               -- 'm' | 'f' | 'n' | NULL (nouns only)
  PRIMARY KEY (language_id, word_lc)
);
